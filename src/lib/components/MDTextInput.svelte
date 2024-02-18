<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec">
	import { formFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";
	import { twMerge } from "tailwind-merge";
	import AutoResizeTextArea from "./AutoResizeTextArea.svelte";
	import Markdown from "./Markdown.svelte";

	export let superform: SuperForm<T>;
	export let field: FormPathLeaves<T>;
	export let preview = false;
	export let minRows: number = 3;
	export let maxRows: number = 50;

	let prev = false;

	const { value, errors } = formFieldProxy(superform, field);
</script>

<label for={field} class="label">
	<span class="label-text">Notes</span>
</label>
{#if preview}
	<div
		class={twMerge(
			"no-script-hide tabs-boxed tabs",
			"rounded-b-none border-[1px] border-b-0 border-base-content [--tw-border-opacity:0.2]"
		)}
	>
		<button type="button" class="tab" class:tab-active={!prev} on:click={() => (prev = false)}>Edit</button>
		<button type="button" class="tab" class:tab-active={prev} on:click={() => (prev = true)}>Preview</button>
	</div>
{/if}
<AutoResizeTextArea
	name={field}
	bind:content={$value}
	class={twMerge("textarea textarea-bordered w-full focus:border-primary", preview && "rounded-t-none", prev && "hidden")}
	{minRows}
	{maxRows}
/>
{#if preview && prev}
	<div class="rounded-b-lg border-[1px] border-base-content bg-base-100 p-4 [--tw-border-opacity:0.2]">
		<Markdown content={`${$value}`} />
	</div>
{/if}
<label for={field} class="label">
	{#if $errors}
		<span class="label-text-alt text-error">{$errors}</span>
	{:else}
		<span class="label-text-alt" />
	{/if}
	<span class="label-text-alt">Markdown Allowed</span>
</label>
