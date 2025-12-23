<script lang="ts">
	import type { GenericFormConfig } from "$lib/factories.svelte";
	import { getContext, type Snippet } from "svelte";

	interface Props {
		name?: string;
		value?: string;
		children?: Snippet;
	}

	const configured = getContext<GenericFormConfig>("configured");
	const { pending } = $derived(configured());

	let { name, value = "Save", children }: Props = $props();
</script>

<button
	type="submit"
	{name}
	{value}
	class="btn btn-primary disabled:bg-primary text-primary-content disabled:bg-opacity-50 disabled:text-opacity-50 w-full sm:w-auto"
	aria-label="Submit"
>
	{#if pending}
		<span class="loading"></span>
	{/if}
	{@render children?.()}
</button>
