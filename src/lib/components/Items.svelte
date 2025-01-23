<script lang="ts">
	import { pushState } from "$app/navigation";
	import type { MagicItem, StoryAward } from "$server/db/schema";
	import { sorter } from "@sillvva/utils";
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
		const itemsMap = new Map<string, number>();
		return $state.snapshot(items).reduce(
			(acc, item, index) => {
				if (index === 0) itemsMap.clear();
				const name = fixName(item.name);
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

	const nonConsumables = $derived(sortedItems.filter((item) => !isConsumable(item.name)));
	const consumables = $derived(sortedItems.filter((item) => isConsumable(item.name)));
</script>

<div
	class="flex flex-1 flex-col data-[col-no-items=true]:hidden md:data-[col-no-items=true]:flex"
	data-col-no-items={collapsible && !items.length}
>
	{#if title}
		<div role="presentation" onclick={collapsible ? () => (collapsed = !collapsed) : () => {}} onkeypress={() => {}}>
			<h4 class="flex text-left font-semibold leading-8 dark:text-white in-[table]:leading-5">
				<span class="flex-1">
					{title}
				</span>
				{#if collapsible}
					<span
						class="iconify ml-2 inline size-6 justify-self-end mdi--chevron-up data-[collapsed=true]:mdi--chevron-down md:hidden print:hidden"
						data-collapsed={collapsed}
					></span>
				{/if}
			</h4>
		</div>
	{/if}
	<p
		class="divide-x divide-black/50 text-sm leading-6 data-[collapsed=true]:hidden dark:divide-white/50 md:data-[collapsed=true]:inline print:text-xs print:data-[collapsed=true]:inline in-[table]:leading-5"
		data-collapsed={collapsed}
	>
		{#if items.length}
			{#each nonConsumables as mi}
				<span
					role={mi.description ? "button" : "presentation"}
					class="inline pl-2 pr-2 first:pl-0"
					class:text-secondary={mi.description}
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
			{#each consumables as mi}
				<span
					role={mi.description ? "button" : "presentation"}
					class="inline pl-2 pr-2 italic first:pl-0"
					class:text-secondary={mi.description}
					class:italic={formatting}
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
