<script lang="ts">
	import type { RemoteFormField } from "@sveltejs/kit";
	import autosize from "svelte-autosize";
	import type { HTMLTextareaAttributes } from "svelte/elements";
	import Markdown from "../markdown.svelte";

	interface Props extends HTMLTextareaAttributes {
		field: RemoteFormField<string>;
		preview?: boolean;
		name?: string;
		minRows?: number;
		maxRows?: number;
		maxLength?: number;
	}

	let { field, preview = false, minRows, maxRows, maxLength, ...rest }: Props = $props();

	let mode = $state("edit");

	const attributes = $derived(field.as("text"));
	const name = $derived(attributes.name);
	const issues = $derived(field.issues());

	const graphemeCount = $derived(typeof field.value() === "string" ? [...new Intl.Segmenter().segment(field.value())].length : 0);
	const lengthDiff = $derived(field.value().length - graphemeCount);

	const markdownTip = "Supports Markdown and HTML. Scripting, media, and form tags are not allowed for security reasons.";
	const graphemeTip = $derived(
		lengthDiff
			? `You have used ${graphemeCount} characters, but ${lengthDiff} are counted differently due to special characters like emojis.`
			: undefined
	);
</script>

<label for={name} class="fieldset-legend">
	<span>Notes</span>
</label>
<div>
	{#if preview}
		<div
			class="tabs-boxed tabs bg-base-200 border-base-content/20 rounded-t-lg rounded-b-none border border-b-0 [--tw-border-opacity:0.2]"
		>
			<input type="radio" name="{name}tabs" role="tab" class="tab rounded-md!" aria-label="Edit" bind:group={mode} value="edit" />
			<input
				type="radio"
				name="{name}tabs"
				role="tab"
				class="tab rounded-md!"
				aria-label="Preview"
				bind:group={mode}
				value="preview"
			/>
		</div>
	{/if}
	<textarea
		{...rest}
		{name}
		id={name}
		bind:value={() => field.value(), (val) => field.set(val)}
		class="textarea textarea-bordered focus:border-primary w-full rounded-b-lg data-[preview=true]:rounded-t-none data-[state=preview]:hidden"
		data-preview={preview}
		data-state={mode}
		style:--minRows={minRows && `${minRows}lh`}
		style:--maxRows={maxRows && `${maxRows}lh`}
		spellcheck="true"
		{@attach autosize}
	></textarea>
	{#if preview && mode === "preview"}
		<div class="border-base-content/20 bg-base-100 rounded-b-lg border p-4 text-sm [--tw-border-opacity:0.2]">
			<Markdown content={field.value()} />
		</div>
	{/if}
</div>
{#if !preview || mode !== "preview"}
	<label for={name} class="fieldset-label justify-between">
		{#if issues?.length}
			<span class="bg-error text-error-content rounded-lg px-2 py-1 text-pretty">{issues}</span>
		{:else}
			<span class="tooltip tooltip-bottom flex items-center gap-1" data-tip={markdownTip}>
				Markdown and HTML Supported
				<span class="iconify mdi--question-mark-circle"></span>
			</span>
		{/if}
		{#if !issues?.length && maxLength}
			<span class="tooltip tooltip-bottom flex items-center gap-1" data-tip={graphemeTip}>
				{field.value().length.toLocaleString()} / {maxLength.toLocaleString()}
				{#if graphemeTip}
					<span class="iconify mdi--question-mark-circle"></span>
				{/if}
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
