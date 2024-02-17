<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec">
	import type { FormPathLeaves, FormPathType } from "sveltekit-superforms";

	import { createEventDispatcher, tick } from "svelte";
	import autosize from "svelte-autosize";
	import type { HTMLTextareaAttributes } from "svelte/elements";

	const dispatch = createEventDispatcher<{
		input: HTMLTextAreaElement;
	}>();

	interface $$Props extends HTMLTextareaAttributes {
		content?: string | FormPathType<T, FormPathLeaves<T>> | null;
		minRows?: number;
		maxRows?: number;
	}

	export let content: string | FormPathType<T, FormPathLeaves<T>> | null = "";
	export let minRows: number | undefined = undefined;
	export let maxRows: number | undefined = undefined;

	let el: HTMLTextAreaElement;

	$: if (content) {
		tick().then(() => {
			autosize.update(el);
		});
	}
</script>

<textarea
	{...$$restProps}
	bind:this={el}
	bind:value={content}
	style:--minRows={minRows && `${minRows}lh`}
	style:--maxRows={maxRows && `${maxRows}lh`}
	spellcheck="true"
	use:autosize
	on:input={() => dispatch("input", el)}
/>

<style>
	textarea {
		resize: none;
		min-height: calc(var(--minRows) + 1rem + 2px);
		max-height: calc(var(--maxRows) + 1rem + 2px);
	}
</style>
