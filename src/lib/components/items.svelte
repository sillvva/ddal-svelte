<script lang="ts">
	import { consolidateItems, getItemSortName, isConsumableItem, type ConsolidatedItem } from "#lib/search.js";
	import type { MagicItem, StoryAward } from "#lib/server/db/schema.js";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { sorter } from "@sillvva/utils";
	import escapeRegex from "regexp.escape";
	import SearchResults from "./search-results.svelte";

	type Item = MagicItem | StoryAward;
	type Type = "Magic Items" | "Story Awards";
	interface Props {
		items: Array<Item>;
		formatting?: boolean;
		terms?: string[];
		filtered?: boolean;
		matches?: number;
		collapsible?: boolean;
		collapsed?: boolean;
		sort?: boolean;
		search?: boolean;
	}

	interface WithType extends Props {
		type: Type;
		title?: never;
	}
	interface WithTitle extends Props {
		type?: never;
		title?: `${Type}${":" | ""}`;
	}

	let {
		type,
		title = type ? undefined : "Magic Items",
		items,
		formatting = false,
		terms = [],
		filtered = false,
		matches = 1,
		collapsible = false,
		collapsed = $bindable(collapsible),
		sort = false,
		search = false
	}: WithType | WithTitle = $props();

	const isStoryAward = $derived(Boolean((title || type)?.startsWith("Story Awards")));
	const isMagicItems = $derived(Boolean((title || type)?.startsWith("Magic Items")));

	const regexes = $derived(terms.map((term) => new RegExp(escapeRegex(term), "gi")));

	const filteredItems = $derived(
		items.filter(
			(item) =>
				!filtered ||
				!terms.length ||
				(matches === 1 ? regexes.every((regex) => item.name.match(regex)) : regexes.some((regex) => item.name.match(regex)))
		)
	);

	const consolidatedItems = $derived(consolidateItems(filteredItems.length ? filteredItems : items, { isStoryAward }));

	const sortedItems = $derived(
		sort ? consolidatedItems.toSorted((a, b) => sorter(getItemSortName(a.name), getItemSortName(b.name))) : consolidatedItems
	);

	const nonConsumables = $derived(sortedItems.filter((item) => !isConsumableItem(item.name, isMagicItems)));
	const consumables = $derived(sortedItems.filter((item) => isConsumableItem(item.name, isMagicItems)));

	function onclick(item: ConsolidatedItem<Item>) {
		const description = item.description?.trim();
		if (description) {
			const url = new URL((page.shallow?.url ?? page.url).href);
			url.searchParams.set("s", item.searchName);

			void goto("", {
				shallow: true,
				state: {
					...page.state,
					modal: {
						type: "text",
						name: item.name,
						description,
						goto: search ? url.toString() : undefined
					}
				}
			});
		} else if (search) {
			const url = new URL((page.shallow?.url ?? page.url).href);
			url.searchParams.set("s", item.searchName);

			void goto(url, {
				shallow: true,
				state: {
					...page.state,
					search: {
						...page.state.search,
						s: item.searchName
					}
				}
			});
		}
	}
</script>

<div
	class="flex flex-1 flex-col data-[col-no-items=true]:hidden md:data-[col-no-items=true]:flex"
	data-col-no-items={collapsible && !items.length}
>
	{#if title}
		<div role="presentation" onclick={collapsible ? () => (collapsed = !collapsed) : () => {}} onkeypress={() => {}}>
			<h4 class="flex text-left leading-8 font-semibold in-[table]:leading-5 dark:text-white">
				<span class="flex-1">{title}</span>

				{#if collapsible}
					<span
						class="ml-2 iconify inline size-6 justify-self-end mdi--chevron-up data-[collapsed=true]:mdi--chevron-down md:hidden print:hidden"
						data-collapsed={collapsed}
					></span>
				{/if}
			</h4>
		</div>
	{/if}
	<p
		class="divide-x divide-black/50 text-sm leading-6 text-wrap in-[table]:leading-5 data-[collapsed=true]:hidden md:data-[collapsed=true]:inline dark:divide-white/50 print:text-xs print:data-[collapsed=true]:inline"
		data-collapsed={collapsed}
	>
		{#if items.length}
			{#each nonConsumables as mi (mi.id)}<span
					role={mi.description?.trim() || search ? "button" : "presentation"}
					class={["inline pr-2 pl-2 first:pl-0", mi.description?.trim() && "text-secondary"]}
					onclick={() => onclick(mi)}
					onkeypress={() => null}
				>
					<SearchResults text={mi.name} {terms} {filtered} {matches} />
				</span>
			{/each}{#each consumables as mi (mi.id)}
				<span
					role={mi.description?.trim() || search ? "button" : "presentation"}
					class={[
						"inline pr-2 pl-2 first:pl-0",
						formatting && "text-base-content/75 italic",
						mi.description?.trim() && "text-secondary"
					]}
					onclick={() => onclick(mi)}
					onkeypress={() => null}
				>
					<SearchResults text={mi.name} {terms} {filtered} {matches} />
				</span>
			{/each}
		{:else}
			None
		{/if}
	</p>
</div>
