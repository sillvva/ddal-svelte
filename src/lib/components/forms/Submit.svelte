<script lang="ts">
	import type { Snippet } from "svelte";
	import { type SuperForm } from "sveltekit-superforms";

	type T = $$Generic<Record<PropertyKey, unknown>>;
	interface Props {
		superform: SuperForm<T>;
		children?: Snippet;
	}

	let { superform, children }: Props = $props();

	const { submitting } = superform;
</script>

<div class="col-span-12 text-center">
	<button
		type="submit"
		class="btn btn-primary disabled:bg-primary disabled:bg-opacity-50 disabled:text-opacity-50 w-full sm:w-auto"
		aria-label="Submit"
	>
		{#if $submitting}
			<span class="loading"></span>
		{/if}
		{@render children?.()}
	</button>
</div>
