<script lang="ts" generics="Input extends RemoteFormInput = RemoteFormInput">
	import type { RemoteFormInput } from "$app/server";
	import type { GenericForm } from "#lib/factories.svelte.js";
	import { type Snippet } from "svelte";

	interface Props {
		form: GenericForm<Input>;
		name?: string;
		value?: string;
		disabled?: boolean;
		children?: Snippet;
	}

	let { form, name, value = "Save", disabled = false, children }: Props = $props();

	const { submitting } = $derived(form);
</script>

<button
	type="submit"
	{name}
	{value}
	class="btn w-full text-primary-content btn-primary disabled:bg-primary disabled:opacity-50 max-sm:text-base sm:w-auto"
	aria-label="Submit"
	disabled={submitting || disabled}
>
	{#if submitting}
		<span class="loading"></span>
	{/if}
	{@render children?.()}
</button>
