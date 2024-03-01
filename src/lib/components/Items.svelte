<script lang="ts">
	import { pushState } from "$app/navigation";
	import type { MagicItem, StoryAward } from "@prisma/client";
	import { sorter } from "@sillvva/utils";
	import { twMerge } from "tailwind-merge";
	import Icon from "./Icon.svelte";
	import SearchResults from "./SearchResults.svelte";

	export let title: string = "";
	export let items: Array<MagicItem | StoryAward>;
	export let formatting: boolean = false;
	export let search: string | null = "";
	export let collapsible: boolean = false;
	export let sort = false;

	let collapsed = collapsible;
	const itemsMap = new Map<string, number>();

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

	$: if (items) itemsMap.clear();
	$: consolidatedItems = structuredClone(items).reduce(
		(acc, item, index, arr) => {
			const name = fixName(clearQty(item.name));
			const qty = itemQty(item);
			const desc = item.description?.trim();
			const key = `${name}_${desc}`;

			const existingIndex = itemsMap.get(key);
			if (existingIndex && existingIndex >= 0) {
				const existingQty = itemQty(acc[existingIndex]);
				acc[existingIndex].name = fixName(name, existingQty + qty);
			} else {
				acc.push({
					...arr[index],
					name: fixName(arr[index].name, qty)
				});
				itemsMap.set(key, acc.length - 1);
			}

			return acc;
		},
		[] as typeof items
	);

	$: sortedItems = sort ? consolidatedItems.sort((a, b) => sorter(sorterName(a.name), sorterName(b.name))) : consolidatedItems;
</script>

<div class={twMerge("flex-1 flex-col", collapsible && !items.length ? "hidden md:flex" : "flex")}>
	{#if title}
		<div role="presentation" on:click={collapsible ? () => (collapsed = !collapsed) : () => {}} on:keypress={() => {}}>
			<h4 class="flex text-left font-semibold leading-8 dark:text-white [table_&]:leading-5">
				<span class="flex-1">
					{title}
				</span>
				{#if collapsible}
					<Icon src="chevron-{collapsed ? 'down' : 'up'}" class="ml-2 inline w-4 justify-self-end md:hidden print:hidden" />
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
					class="inline pl-2 pr-1 first:pl-0"
					class:text-secondary={mi.description}
					class:italic={formatting && isConsumable(mi.name)}
					on:click={() => {
						if (mi.description) {
							pushState("", { modal: { type: "text", name: mi.name, description: mi.description } });
						}
					}}
					on:keypress={() => null}
				>
					<SearchResults text={mi.name} search={search || ""} />
				</span>
			{/each}
		{:else}
			None
		{/if}
	</p>
</div>
