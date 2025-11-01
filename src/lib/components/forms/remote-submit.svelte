<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		name?: string;
		value?: string;
		children?: Snippet;
	}

	let { name, value = "Save", children }: Props = $props();
</script>

<button
	type="submit"
	{name}
	{value}
	class="btn btn-primary disabled:bg-primary text-primary-content disabled:bg-opacity-50 disabled:text-opacity-50 w-full sm:w-auto"
	aria-label="Submit"
>
	{#if !!$effect.pending()}
		<span class="loading"></span>
	{/if}
	{@render children?.()}
</button>
