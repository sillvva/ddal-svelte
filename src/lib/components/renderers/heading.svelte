<script lang="ts">
	import { slugify } from "@sillvva/utils";
	import type { Snippet } from "svelte";

	interface Props {
		depth: number;
		raw?: unknown;
		text?: string;
		children?: Snippet;
	}

	let { depth, raw = "", text = "", children }: Props = $props();

	let id = $derived(slugify(text));
</script>

{#if depth === 1}
	<h3 {id} class="mt-6 mb-2 text-3xl font-bold first:mt-0">
		{@render children?.()}
	</h3>
{:else if depth === 2}
	<h4 {id} class="mt-4 mb-2 text-2xl font-bold first:mt-0">
		{@render children?.()}
	</h4>
{:else if depth === 3}
	<h5 {id} class="mt-4 mb-1 text-xl font-semibold first:mt-0">
		{@render children?.()}
	</h5>
{:else if depth === 4}
	<h6 {id} class="mt-3 mb-1 text-base font-semibold first:mt-0">
		{@render children?.()}
	</h6>
{:else}
	{raw}
{/if}
