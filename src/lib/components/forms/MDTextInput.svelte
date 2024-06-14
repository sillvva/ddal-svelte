<script lang="ts">
	import { formFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";
	import { twMerge } from "tailwind-merge";
	import Markdown from "../Markdown.svelte";
	import AutoResizeTextArea from "./AutoResizeTextArea.svelte";

	type T = $$Generic<Record<string, unknown>>;

	export let superform: SuperForm<T>;
	export let field: FormPathLeaves<T, string>;
	export let preview = false;
	export let minRows: number | undefined = undefined;
	export let maxRows: number | undefined = undefined;

	let prev = false;

	const { value, errors, constraints } = formFieldProxy(superform, field);
</script>

<label for={field} class="label">
	<span class="label-text">Notes</span>
</label>
{#if preview}
	<div class="tabs-boxed tabs rounded-b-none border-[1px] border-b-0 border-base-content [--tw-border-opacity:0.2]">
		<button type="button" class="tab" class:tab-active={!prev} on:click={() => (prev = false)}>Edit</button>
		<button type="button" class="tab" class:tab-active={prev} on:click={() => (prev = true)}>Preview</button>
	</div>
{/if}
<AutoResizeTextArea
	id={field}
	bind:content={$value}
	class={twMerge("textarea textarea-bordered w-full focus:border-primary", preview && "rounded-t-none", prev && "hidden")}
	{minRows}
	{maxRows}
	{...$constraints}
/>
{#if preview && prev}
	<div class="rounded-b-lg border-[1px] border-base-content bg-base-100 p-4 [--tw-border-opacity:0.2]">
		<Markdown content={`${$value}`} />
	</div>
{:else}
	<label for={field} class="label">
		{#if $errors?.length}
			<span class="label-text-alt text-error">{$errors}</span>
		{:else}
			<span class="label-text-alt">Markdown Allowed</span>
		{/if}
		{#if !($errors || []).length && $constraints?.maxlength}
			<span class="label-text-alt">{`${$value}`.length.toLocaleString()} / {$constraints?.maxlength.toLocaleString()}</span>
		{/if}
	</label>
{/if}
