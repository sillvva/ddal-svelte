<script lang="ts">
	import { createEventDispatcher, tick } from "svelte";
	import autosize from "svelte-autosize";
	import type { HTMLTextareaAttributes } from "svelte/elements";

	const dispatch = createEventDispatcher<{
		input: HTMLTextAreaElement;
	}>();

	interface $$Props extends HTMLTextareaAttributes {
		value?: string | null;
		minRows?: number;
		maxRows?: number;
	}

	export let value: string | null = "";
	export let minRows: number | undefined = undefined;
	export let maxRows: number | undefined = undefined;

	let el: HTMLTextAreaElement;

	$: if (value) {
		tick().then(() => {
			autosize.update(el);
		});
	}
</script>

<textarea
	{...$$restProps}
	bind:this={el}
	bind:value
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
