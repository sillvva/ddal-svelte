<script lang="ts">
	import { pushState } from "$app/navigation";
	import type { MagicItem, StoryAward } from "$server/db/schema";
	import { sorter } from "@sillvva/utils";
	import { twMerge } from "tailwind-merge";
	import SearchResults from "./SearchResults.svelte";

	interface Props {
		title?: string;
		items: Array<MagicItem | StoryAward>;
		formatting?: boolean;
		search?: string | null;
		collapsible?: boolean;
		sort?: boolean;
	}

	let { title = "", items, formatting = false, search = "", collapsible = false, sort = false }: Props = $props();

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
	const clearQty = (name: string) => name.replace(/^\d+x? ?/, "");
	const fixName = (name: string, qty = 1) => {
		let val = name
			.trim()
			.replace(/^(Potion|Scroll|Spell Scroll)s/, "$1")
			.replace("Spell Scroll", "Scroll")
			.replace(/^(\d+)x? /, "");

		if (qty > 1) {
			if (isConsumable(name)) val = val.replace(/^(Potion|Scroll|Spell Scroll)( .+)$/, "$1s$2");
			val = `${qty} ${val}`;
		} else {
			val = val;
		}
		return val;
	};

	const consolidatedItems = $derived.by(() => {
		const itemsMap = new Map<string, number>();
		return $state.snapshot(items).reduce(
			(acc, item, index) => {
				if (index === 0) itemsMap.clear();
				const name = fixName(clearQty(item.name));
				const qty = itemQty(item);
				const desc = item.description?.trim();
				const key = `${name}_${desc}`;

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
		sort ? consolidatedItems.sort((a, b) => sorter(sorterName(a.name), sorterName(b.name))) : consolidatedItems
	);
</script>

<div class={twMerge("flex-1 flex-col", collapsible && !items.length ? "hidden md:flex" : "flex")}>
	{#if title}
		<div role="presentation" onclick={collapsible ? () => (collapsed = !collapsed) : () => {}} onkeypress={() => {}}>
			<h4 class="flex text-left font-semibold leading-8 dark:text-white [table_&]:leading-5">
				<span class="flex-1">
					{title}
				</span>
				{#if collapsible}
					<span
						class={twMerge(
							"iconify ml-2 inline size-6 justify-self-end md:hidden print:hidden",
							collapsed ? "mdi--chevron-down" : "mdi--chevron-up"
						)}
					></span>
				{/if}
			</h4>
		</div>
	{/if}
	<p
		class={twMerge(
			"divide-x divide-black/50 text-sm leading-6 dark:divide-white/50 print:text-xs [table_&]:leading-5",
			collapsed ? "hidden md:inline print:inline" : ""
		)}
	>
		{#if items.length}
			{#each sortedItems as mi}
				<span
					role={mi.description ? "button" : "presentation"}
					class="inline pl-2 pr-2 first:pl-0"
					class:text-secondary={mi.description}
					class:italic={formatting && isConsumable(mi.name)}
					onclick={() => {
						if (mi.description) {
							pushState("", { modal: { type: "text", name: mi.name, description: mi.description } });
						}
					}}
					onkeypress={() => null}
				>
					<SearchResults text={mi.name} {search} />
				</span>
			{/each}
		{:else}
			None
		{/if}
	</p>
</div>
