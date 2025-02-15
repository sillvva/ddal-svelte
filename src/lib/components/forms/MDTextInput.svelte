<script lang="ts">
	import autosize from "svelte-autosize";
	import type { HTMLTextareaAttributes } from "svelte/elements";
	import { formFieldProxy, type FormFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";
	import Markdown from "../Markdown.svelte";

	type T = $$Generic<Record<PropertyKey, unknown>>;
	interface Props extends HTMLTextareaAttributes {
		superform: SuperForm<T>;
		field: FormPathLeaves<T, string>;
		preview?: boolean;
		name?: string;
		minRows?: number;
		maxRows?: number;
	}

	let {
		superform,
		field,
		preview = false,
		name = `mdtab${Math.round(Math.random() * 100000)}`,
		minRows,
		maxRows,
		...rest
	}: Props = $props();

	let state = $state("edit");

	const { value, errors, constraints } = formFieldProxy(superform, field) satisfies FormFieldProxy<string>;

	const graphemeCount = $derived(typeof $value === "string" ? [...new Intl.Segmenter().segment($value)].length : 0);
	const lengthDiff = $derived($value.length - graphemeCount);
</script>

<label for={field} class="fieldset-legend">
	<span>Notes</span>
</label>
<div>
	{#if preview}
		<div
			class="tabs-boxed tabs bg-base-200 border-base-content/20 rounded-t-lg rounded-b-none border-[1px] border-b-0 [--tw-border-opacity:0.2]"
		>
			<input type="radio" {name} role="tab" class="tab rounded-md!" aria-label="Edit" bind:group={state} value="edit" />
			<input type="radio" {name} role="tab" class="tab rounded-md!" aria-label="Preview" bind:group={state} value="preview" />
		</div>
	{/if}
	<textarea
		{...rest}
		id={field}
		bind:value={$value}
		class="textarea textarea-bordered focus:border-primary w-full rounded-b-lg data-[preview=true]:rounded-t-none data-[state=preview]:hidden"
		data-preview={preview}
		data-state={state}
		style:--minRows={minRows && `${minRows}lh`}
		style:--maxRows={maxRows && `${maxRows}lh`}
		spellcheck="true"
		use:autosize
		{...$constraints}
		maxlength={($constraints?.maxlength ?? 0) + lengthDiff}
	></textarea>
	{#if preview && state === "preview"}
		<div class="border-base-content/20 bg-base-100 rounded-b-lg border-[1px] p-4 [--tw-border-opacity:0.2]">
			<Markdown content={$value} />
		</div>
	{/if}
</div>
{#if !preview || state !== "preview"}
	<label for={field} class="fieldset-label">
		{#if $errors?.length}
			<span class="text-error">{$errors}</span>
		{:else}
			<span>Markdown Allowed</span>
		{/if}
		{#if !$errors?.length && $constraints?.maxlength}
			<span>{graphemeCount.toLocaleString()} / {$constraints?.maxlength.toLocaleString()}</span>
		{/if}
	</label>
{/if}

<style>
	textarea {
		resize: none;
		min-height: calc(var(--minRows, 3lh) + 1rem + 2px);
		max-height: calc(var(--maxRows, 50lh) + 1rem + 2px);
	}
</style>
