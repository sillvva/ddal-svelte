<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec">
	import autosize from "svelte-autosize";
	import type { HTMLTextareaAttributes } from "svelte/elements";
	import type { FormPathLeaves, FormPathType } from "sveltekit-superforms";

	interface $$Props extends HTMLTextareaAttributes {
		content: FormPathType<T, FormPathLeaves<T, string>>;
		minRows?: number;
		maxRows?: number;
	}

	export let content: FormPathType<T, FormPathLeaves<T, string>>;
	export let minRows: number = 3;
	export let maxRows: number = 50;
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
		min-height: calc(var(--minRows) + 1rem + 2px);
		max-height: calc(var(--maxRows) + 1rem + 2px);
	}
</style>
