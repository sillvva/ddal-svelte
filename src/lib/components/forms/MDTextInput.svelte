<script lang="ts">
	import autosize from "svelte-autosize";
	import { formFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";
	import { twMerge } from "tailwind-merge";
	import Markdown from "../Markdown.svelte";

	type T = $$Generic<Record<PropertyKey, unknown>>;

	export let superform: SuperForm<T>;
	export let field: FormPathLeaves<T, string>;
	export let preview = false;
	export let name = `mdtab${Math.round(Math.random() * 100000)}`;
	export let minRows: number | undefined = undefined;
	export let maxRows: number | undefined = undefined;

	let state = "edit";

	const { value, errors, constraints } = formFieldProxy(superform, field);

	$: graphemeCount = typeof $value === "string" ? [...new Intl.Segmenter().segment($value)].length : 0;
	$: lengthDiff = $value.length - graphemeCount;
</script>

<label for={field} class="label">
	<span class="label-text">Notes</span>
</label>
{#if preview}
	<div class="tabs-boxed tabs rounded-b-none border-[1px] border-b-0 border-base-content [--tw-border-opacity:0.2]">
		<input type="radio" {name} role="tab" class="tab !rounded-md" aria-label="Edit" bind:group={state} value="edit" />
		<input type="radio" {name} role="tab" class="tab !rounded-md" aria-label="Preview" bind:group={state} value="preview" />
	</div>
{/if}
<textarea
	{...$$restProps}
	id={field}
	bind:value={$value}
	class={twMerge(
		"textarea textarea-bordered w-full focus:border-primary",
		preview && "rounded-t-none",
		state === "preview" && "hidden"
	)}
	style:--minRows={minRows && `${minRows}lh`}
	style:--maxRows={maxRows && `${maxRows}lh`}
	spellcheck="true"
	use:autosize
	{...$constraints}
	maxlength={($constraints?.maxlength ?? 0) + lengthDiff}
></textarea>
{#if preview && state === "preview"}
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
		{#if !$errors?.length && $constraints?.maxlength}
			<span class="label-text-alt">{graphemeCount.toLocaleString()} / {$constraints?.maxlength.toLocaleString()}</span>
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
