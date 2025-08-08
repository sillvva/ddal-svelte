<script lang="ts">
	import { pushState } from "$app/navigation";
	import type { MagicItem, StoryAward } from "$lib/server/db/schema";
	import { sorter } from "@sillvva/utils";
	import { SvelteMap } from "svelte/reactivity";
	import { twMerge } from "tailwind-merge";
	import SearchResults from "./SearchResults.svelte";

	interface Props {
		title?: string;
		items: Array<MagicItem | StoryAward>;
		formatting?: boolean;
		terms?: string[];
		collapsible?: boolean;
		sort?: boolean;
		textClass?: string;
	}

	let { title = "", items, formatting = false, terms = [], collapsible = false, sort = false, textClass = "" }: Props = $props();

	let collapsed = $state(collapsible);

	const sorterName = (name: string) =>
		sort
			? name
					.replace(/^\d+x? ?/, "")
					.replace("Spell Scroll", "Scroll")
					.replace(/^(\w+)s/, "$1")
					.replace(/^(A|An|The) /, "")
			: name;
	const isConsumable = (name: string) =>
		name.trim().match(/^(\d+x? )?((Potion|Scroll|Spell Scroll|Charm|Elixir)s? of)|Alchemist('?s)? Fire|Antitoxin/);
	const itemQty = (item: { name: string }) => parseInt(item.name.match(/^(\d+)x? /)?.[1] || "1");
	const fixName = (name: string, qty = 1) => {
		let val = name
			.trim()
			.replace(/^\d+x? ?/, "")
			.replace(/^(Potion|Scroll|Spell Scroll)s/, "$1")
			.replace("Spell Scroll", "Scroll");

		if (qty > 1) {
			if (isConsumable(name)) val = val.replace(/^(Potion|Scroll|Spell Scroll)( .+)$/, "$1s$2");
			val = `${qty} ${val}`;
		} else {
			val = val;
		}
		return val;
	};

	const consolidatedItems = $derived.by(() => {
		const itemsMap = new SvelteMap<string, number>();
		return $state.snapshot(items).reduce(
			(acc, item) => {
				const name = fixName(item.name);
				const qty = itemQty(item);
				const desc = item.description?.trim();
				const key = `${name || ""}_${desc || ""}`;

				const existingIndex = itemsMap.get(key);
				if (existingIndex !== undefined && acc[existingIndex]) {
					const existingQty = itemQty(acc[existingIndex]!);
					acc[existingIndex]!.name = fixName(name, existingQty + qty);
				} else {
					item.name = fixName(item.name, qty);
					itemsMap.set(key, acc.length);
					acc.push(item);
				}

				return acc;
			},
			[] as typeof items
		);
	});

	const sortedItems = $derived(
		sort ? consolidatedItems.toSorted((a, b) => sorter(sorterName(a.name), sorterName(b.name))) : consolidatedItems
	);

	const nonConsumables = $derived(sortedItems.filter((item) => !isConsumable(item.name)));
	const consumables = $derived(sortedItems.filter((item) => isConsumable(item.name)));
</script>

<div
	class="flex flex-1 flex-col data-[col-no-items=true]:hidden md:data-[col-no-items=true]:flex"
	data-col-no-items={collapsible && !items.length}
>
	{#if title}
		<div role="presentation" onclick={collapsible ? () => (collapsed = !collapsed) : () => {}} onkeypress={() => {}}>
			<h4 class="flex text-left leading-8 font-semibold in-[table]:leading-5 dark:text-white">
				<span class="flex-1">
					{title}
				</span>
				{#if collapsible}
					<span
						class="iconify mdi--chevron-up data-[collapsed=true]:mdi--chevron-down ml-2 inline size-6 justify-self-end md:hidden print:hidden"
						data-collapsed={collapsed}
					></span>
				{/if}
			</h4>
		</div>
	{/if}
	<p
		class={twMerge(
			"divide-x divide-black/50 text-sm leading-6 text-wrap in-[table]:leading-5 data-[collapsed=true]:hidden md:data-[collapsed=true]:inline dark:divide-white/50 print:text-xs print:data-[collapsed=true]:inline",
			textClass
		)}
		data-collapsed={collapsed}
	>
		{#if items.length}
			{#each nonConsumables as mi (mi.id)}<span
					role={mi.description ? "button" : "presentation"}
					class="inline pr-2 pl-2 first:pl-0"
					class:text-secondary={mi.description}
					onclick={() => {
						if (mi.description) {
							pushState("", { modal: { type: "text", name: mi.name, description: mi.description } });
						}
					}}
					onkeypress={() => null}
				>
					<SearchResults text={mi.name} {terms} />
				</span>{/each}{#each consumables as mi (mi.id)}<span
					role={mi.description ? "button" : "presentation"}
					class="inline pr-2 pl-2 italic first:pl-0"
					class:text-secondary={mi.description}
					class:italic={formatting}
					onclick={() => {
						if (mi.description) {
							pushState("", { modal: { type: "text", name: mi.name, description: mi.description } });
						}
					}}
					onkeypress={() => null}
				>
					<SearchResults text={mi.name} {terms} />
				</span>{/each}
		{:else}
			None
		{/if}
	</p>
</div>
