<script lang="ts">
	import { slugify } from "@sillvva/utils";
	import type { Snippet } from "svelte";
	import { twMerge } from "tailwind-merge";

	interface Props {
		depth: number;
		raw?: any;
		text?: string;
		class?: string;
		children?: Snippet;
	}

	let { depth, raw = "", text = "", class: className = "", children }: Props = $props();

	let id = $derived(slugify(text));
</script>

{#if depth === 1}
	<h1 {id} class={twMerge("mt-6 mb-2 text-3xl font-bold first:mt-0", className)}>
		{@render children?.()}
	</h1>
{:else if depth === 2}
	<h2 {id} class={twMerge("mt-4 mb-2 text-2xl font-bold first:mt-0", className)}>
		{@render children?.()}
	</h2>
{:else if depth === 3}
	<h3 {id} class={twMerge("mt-4 mb-1 text-xl font-semibold first:mt-0", className)}>
		{@render children?.()}
	</h3>
{:else if depth === 4}
	<h4 {id} class={twMerge("mt-3 mb-1 text-base font-semibold first:mt-0", className)}>
		{@render children?.()}
	</h4>
{:else if depth === 5}
	<h5 {id} class={twMerge("mt-2 mb-1 text-sm font-semibold first:mt-0", className)}>
		{@render children?.()}
	</h5>
{:else}
	{raw}
{/if}
