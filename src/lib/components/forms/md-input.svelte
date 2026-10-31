<script lang="ts">
	import type { RemoteFormField } from "$app/server";
	import autosize from "svelte-autosize";
	import type { HTMLTextareaAttributes } from "svelte/elements";
	import Markdown from "../markdown.svelte";

	interface Props extends HTMLTextareaAttributes {
		field: RemoteFormField<string>;
		preview?: boolean;
		minRows?: number;
		maxRows?: number;
		maxLength?: number;
	}

	let { field, preview = false, minRows, maxRows, maxLength, ...rest }: Props = $props();

	let mode = $state("edit");

	const attributes = $derived(field.as("text"));
	const name = $derived(attributes.name);
	const issues = $derived(field.issues());
	const value = $derived(field.value() || "");

	const segmenter = new Intl.Segmenter();
	const graphemes = $derived(typeof value === "string" ? [...segmenter.segment(value)] : []);
	const graphemeCount = $derived(graphemes.length);

	const markdownTip = "Supports Markdown and HTML. Scripting, media, and form tags are not allowed for security reasons.";
</script>

<label for={name} class="fieldset-legend">
	<span>Notes</span>
</label>
<div>
	{#if preview}
		<div
			class="tabs-boxed tabs rounded-t-lg rounded-b-none border border-b-0 border-base-content/20 bg-base-200 [--tw-border-opacity:0.2]"
		>
			<input type="radio" role="tab" class="tab rounded-md!" aria-label="Edit" bind:group={mode} value="edit" />
			<input type="radio" role="tab" class="tab rounded-md!" aria-label="Preview" bind:group={mode} value="preview" />
		</div>
	{/if}
	<textarea
		{...rest}
		{name}
		id={name}
		bind:value={() => field.value(), (val) => field.set(val)}
		class="textarea-bordered textarea w-full rounded-b-lg focus:border-primary data-[preview=true]:rounded-t-none data-[state=preview]:hidden max-sm:text-base"
		data-preview={preview}
		data-state={mode}
		style:--minRows={minRows && `${minRows}lh`}
		style:--maxRows={maxRows && `${maxRows}lh`}
		spellcheck="true"
		{@attach autosize}></textarea>
	{#if preview && mode === "preview"}
		<div class="rounded-b-lg border border-base-content/20 bg-base-100 p-4 text-sm [--tw-border-opacity:0.2]">
			<Markdown content={field.value()} />
		</div>
	{/if}
</div>
{#if !preview || mode !== "preview"}
	<label for={name} class="fieldset-label justify-between">
		{#if issues?.length}
			<span class="rounded-lg bg-error px-2 py-1 text-pretty text-error-content">{issues}</span>
		{:else}
			<span class="tooltip tooltip-bottom flex items-center gap-1" data-tip={markdownTip}>
				Markdown and HTML Supported
				<span class="iconify mdi--question-mark-circle"></span>
			</span>
		{/if}
		{#if !issues?.length && maxLength}
			<span class="tooltip tooltip-bottom flex items-center gap-1">
				{graphemeCount.toLocaleString()} / {maxLength.toLocaleString()}
			</span>
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
