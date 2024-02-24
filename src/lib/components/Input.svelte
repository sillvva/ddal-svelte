<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec, TType extends 'text' | 'number'">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { formFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";

	interface $$Props extends HTMLInputAttributes {
		superform: SuperForm<T>;
		field: FormPathLeaves<T, TType extends 'text' ? string : TType extends 'number' ? number : never>;
		type: TType;
		oninput?: (value: typeof $value) => void;
	}

	export let superform: SuperForm<T>;
	export let field: FormPathLeaves<T>;
	export let type: TType;
	export let description = "";
	export let oninput = (value: typeof $value) => {};

	const { value, errors, constraints } = formFieldProxy(superform, field);

	$: commonProps = {
		id: field,
		class: "input input-bordered w-full focus:border-primary",
		"aria-invalid": $errors ? "true" : undefined,
		...$constraints,
		...$$restProps
	} satisfies HTMLInputAttributes;
</script>

<label for={field} class="label">
	<span class="label-text">
		<slot />
		{#if commonProps.required}
			<span class="text-error">*</span>
		{/if}
	</span>
</label>
{#if type === "text"}
	<input type="text" bind:value={$value} on:input={() => oninput($value)} {...commonProps} />
{:else if type === "number"}
	<input type="number" bind:value={$value} on:input={() => oninput($value)} {...commonProps} />
{/if}
{#if $errors?.length || description}
	<label for={field} class="label">
		{#if $errors?.length}
			<span class="label-text-alt text-error">{$errors[0]}</span>
		{:else}
			<span class="label-text-alt text-neutral-500">{description}</span>
		{/if}
	</label>
{/if}
