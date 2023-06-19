<script lang="ts">
	import type { MagicItem, StoryAward } from "@prisma/client";
	import { twMerge } from "tailwind-merge";
	import Markdown from "./Markdown.svelte";
	import SearchResults from "./SearchResults.svelte";

	export let title: string = "";
	export let items: (MagicItem | StoryAward)[];
	export let formatting: boolean = false;
	export let search: string = "";
	export let collapsible: boolean = false;

	let modal: { name: string; description: string; date?: Date } | null = null;
	let collapsed = collapsible;
</script>

<div class={twMerge("flex-1 flex-col", collapsible && !items.length ? "hidden md:flex" : "flex")}>
	{#if title}
		<h4 class="flex font-semibold" on:click={collapsible ? () => (collapsed = !collapsed) : () => {}} on:keypress={() => {}}>
			<span class="flex-1">{title}</span>
			{#if collapsible}
				{#if collapsed}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						class="ml-2 inline w-4 justify-self-end print:hidden md:hidden"
						><title>chevron-down</title><path
							fill="currentColor"
							d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"
						/></svg
					>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						class="ml-2 inline w-4 justify-self-end print:hidden md:hidden"
						><title>chevron-up</title><path
							fill="currentColor"
							d="M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z"
						/></svg
					>
				{/if}
			{/if}
		</h4>
	{/if}
	<p class={twMerge("divide-x whitespace-pre-wrap text-sm print:text-xs", collapsed ? "hidden print:block md:block" : "")}>
		{#if items.length}
			{#each items as mi}
				<span
					class="whitespace-pre-wrap pl-2 first:pl-0"
					on:click={() => {
						if (mi.description) {
							modal = { name: mi.name, description: mi.description };
						}
					}}
					on:keypress={() => null}
				>
					{#if formatting && !mi.name.match(/^(\d+x? )?((Potion|Scroll|Spell Scroll|Charm|Elixir)s? of)/)}
						<strong class="text-secondary-content/70 print:text-neutral-content">
							<SearchResults text={mi.name} search={search || ""} />
						</strong>
					{:else}
						<SearchResults text={mi.name} search={search || ""} />
					{/if}
					{mi.description && "*"}
				</span>
			{/each}
		{:else}
			None
		{/if}
	</p>
</div>
<div class={twMerge("modal cursor-pointer", modal && "modal-open")} on:click={() => (modal = null)} on:keypress={() => null}>
	{#if modal}
		<div class="modal-box relative cursor-default drop-shadow-lg" on:click={(e) => e.stopPropagation()} on:keypress={() => null}>
			<h3 class="cursor-text text-lg font-bold text-accent-content">{modal.name}</h3>
			{#if modal.date}
				<p class="text-xs">{modal.date.toLocaleString()}</p>
			{/if}
			<Markdown content={modal.description} class="cursor-text whitespace-pre-wrap pt-4 text-xs sm:text-sm" />
		</div>
	{/if}
</div>
