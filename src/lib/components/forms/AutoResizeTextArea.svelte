<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec">
	import type { NonBrandedFormPathLeaves } from "$lib/util";
	import autosize from "svelte-autosize";
	import type { HTMLTextareaAttributes } from "svelte/elements";
	import type { FormPathType } from "sveltekit-superforms";

	interface $$Props extends HTMLTextareaAttributes {
		content: FormPathType<T, NonBrandedFormPathLeaves<T, string>>;
		minRows?: number;
		maxRows?: number;
	}

	export let content: FormPathType<T, NonBrandedFormPathLeaves<T, string>>;
	export let minRows: number | undefined = undefined;
	export let maxRows: number | undefined = undefined;
</script>

<textarea
	{...$$restProps}
	bind:value={content}
	style:--minRows={minRows && `${minRows}lh`}
	style:--maxRows={maxRows && `${maxRows}lh`}
	spellcheck="true"
	use:autosize
/>

<style>
	textarea {
		resize: none;
		min-height: calc(var(--minRows, 3lh) + 1rem + 2px);
		max-height: calc(var(--maxRows, 50lh) + 1rem + 2px);
	}
</style>
