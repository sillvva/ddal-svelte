<script lang="ts">
	import type { GenericFormConfig } from "$lib/factories.svelte";
	import { getContext, type Snippet } from "svelte";

	interface Props {
		name?: string;
		value?: string;
		children?: Snippet;
	}

	const configured = getContext<GenericFormConfig>("configured");
	const { submitting } = $derived(configured());

	let { name, value = "Save", children }: Props = $props();
</script>

<button
	type="submit"
	{name}
	{value}
	class="btn btn-primary disabled:bg-primary text-primary-content w-full disabled:opacity-50 sm:w-auto"
	aria-label="Submit"
>
	{#if submitting}
		<span class="loading"></span>
	{/if}
	{@render children?.()}
</button>
