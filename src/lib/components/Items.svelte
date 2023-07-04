<script lang="ts">
	import type { MagicItem, StoryAward } from "@prisma/client";
	import type { SearchResult } from "minisearch";
	import { twMerge } from "tailwind-merge";
	import { sorter } from "../misc";
	import Icon from "./Icon.svelte";
	import Markdown from "./Markdown.svelte";
	import SearchResults from "./SearchResults.svelte";

	export let title: string = "";
	export let items: (MagicItem | StoryAward)[];
	export let formatting: boolean = false;
	export let search: string = "";
	export let collapsible: boolean = false;
	export let msResult: SearchResult | null | undefined = null;
	export let sort = false;

	let modal: { name: string; description: string; date?: Date } | null = null;
	let collapsed = collapsible;

	function sorterName(name: string) {
		return name
			.replace(/^\d+x? ?/, "")
			.replace("Spell Scroll", "Scroll")
			.replace(/^(\w+)s/, "$1")
			.replace(/^(A|An|The) /, "");
	}

	$: dupItems = JSON.parse(JSON.stringify(items)) as typeof items;

	$: consolidatedItems = dupItems.reduce((acc, item) => {
		const qtyM = item.name.match(/^(\d+)x? /);
		const qty = qtyM ? parseInt(qtyM[1]) : 1;

		const existing = acc.findIndex(
			(ex) => sorterName(ex.name) === sorterName(item.name) && ex.description?.trim() === item.description?.trim()
		);
		if (existing >= 0) {
			const existingQtyM = acc[existing].name.match(/^(\d+)x? /);
			const existingQty = existingQtyM ? parseInt(existingQtyM[1]) : 1;

			const newQty = existingQty + qty;
			let newName = acc[existing].name.replace(/^\d+x? ?/, "").replace(/^(\w+)s/, "$1");

			if (newQty > 1) {
				if (newName.trim().match(/^((Potion|Scroll|Spell Scroll|Charm|Elixir)s? of)/))
					newName = newName.replace(/^(\w+)( .+)$/, "$1s$2");
				acc[existing].name = `${newQty} ${newName}`;
			} else {
				acc[existing].name = newName;
			}

			return acc;
		} else {
			let newName = item.name.replace(/^\d+x? ?/, "").replace(/^(\w+)s/, "$1");

			if (qty > 1) {
				if (newName.trim().match(/^((Potion|Scroll|Spell Scroll|Charm|Elixir)s? of)/))
					newName = newName.replace(/^(\w+)( .+)$/, "$1s$2");
				item.name = `${qty} ${newName}`;
			} else {
				item.name = newName;
			}
		}

		return [...acc, item];
	}, [] as typeof items);

	$: sortedItems = sort ? consolidatedItems.sort((a, b) => sorter(sorterName(a.name), sorterName(b.name))) : consolidatedItems;
</script>

<div class={twMerge("flex-1 flex-col", collapsible && !items.length ? "hidden md:flex" : "flex")}>
	{#if title}
		<button
			on:click={collapsible ? () => (collapsed = !collapsed) : () => {}}
			on:keypress={() => {}}
			class="md:cursor-text md:select-text"
		>
			<h4 class="flex text-left font-semibold">
				<span class="flex-1">
					{title}
				</span>
				{#if collapsible}
					{#if collapsed}
						<Icon src="chevron-down" class="ml-2 inline w-4 justify-self-end print:hidden md:hidden" />
					{:else}
						<Icon src="chevron-up" class="ml-2 inline w-4 justify-self-end print:hidden md:hidden" />
					{/if}
				{/if}
			</h4>
		</button>
	{/if}
	<p class={twMerge("divide-x text-sm print:text-xs", collapsed ? "hidden print:inline md:inline" : "")}>
		{#if items.length}
			{#each sortedItems as mi}
				<span
					role="button"
					tabindex="0"
					class="inline pl-2 pr-1 first:pl-0"
					on:click={() => {
						if (mi.description) {
							modal = { name: mi.name, description: mi.description };
						}
					}}
					on:keypress={() => null}
				>
					{#if formatting && !mi.name.match(/^(\d+x? )?((Potion|Scroll|Spell Scroll|Charm|Elixir)s? of)/)}
						<strong class="text-secondary-content/70 print:text-neutral-content">
							<SearchResults text={mi.name + (mi.description && "*")} search={search || ""} {msResult} />
						</strong>
					{:else}
						<SearchResults text={mi.name + (mi.description && "*")} search={search || ""} {msResult} />
					{/if}
				</span>
			{/each}
		{:else}
			None
		{/if}
	</p>
</div>
<div
	role="presentation"
	class={twMerge("modal cursor-pointer", modal && "modal-open")}
	on:click={() => (modal = null)}
	on:keypress={() => null}
>
	{#if modal}
		<div
			role="presentation"
			class="modal-box relative cursor-default drop-shadow-lg"
			on:click={(e) => e.stopPropagation()}
			on:keypress={() => null}
		>
			<h3 class="cursor-text text-lg font-bold text-accent-content">{modal.name}</h3>
			{#if modal.date}
				<p class="text-xs">{modal.date.toLocaleString()}</p>
			{/if}
			<Markdown content={modal.description} class="cursor-text whitespace-pre-wrap pt-4 text-xs sm:text-sm" />
		</div>
	{/if}
</div>
