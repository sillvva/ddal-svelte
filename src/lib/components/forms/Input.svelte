<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import {
		dateProxy,
		formFieldProxy,
		numberProxy,
		type FormPathLeaves,
		type FormPathType,
		type SuperForm
	} from "sveltekit-superforms";

	type T = $$Generic<Record<PropertyKey, unknown>>;
	type TType = $$Generic<"text" | "url" | "number" | "date">;
	type LeafType = TType extends "text" | "url"
		? string
		: TType extends "number"
			? number
			: TType extends "date"
				? Date
				: undefined;
	interface Props extends Omit<HTMLInputAttributes, "onchange" | "oninput"> {
		superform: SuperForm<T>;
		field: FormPathLeaves<T, LeafType>;
		label: string;
		type: TType;
		empty?: TType extends "date" ? "null" | "undefined" : undefined;
		minField?: TType extends "number" | "date" ? FormPathLeaves<T, LeafType> : never;
		maxField?: TType extends "number" | "date" ? FormPathLeaves<T, LeafType> : never;
		readonly?: boolean;
		description?: string;
		oninput?: (value: FormPathType<T, FormPathLeaves<T, LeafType>>) => void;
		onchange?: (value: FormPathType<T, FormPathLeaves<T, LeafType>>) => void;
	}

	let {
		superform,
		field,
		label,
		type,
		empty = "null",
		minField,
		maxField,
		readonly,
		description,
		oninput,
		onchange,
		...rest
	}: Props = $props();

	const { value, errors, constraints } = formFieldProxy(superform, field);

	const proxyDate = type === "date" ? dateProxy(superform, field, { format: "datetime-local", empty }) : undefined;
	const proxyMin = minField
		? type === "number"
			? numberProxy(superform, minField)
			: dateProxy(superform, minField, { format: "datetime-local" })
		: undefined;
	const proxyMax = maxField
		? type === "number"
			? numberProxy(superform, maxField)
			: dateProxy(superform, maxField, { format: "datetime-local" })
		: undefined;

	const commonProps = $derived({
		id: field,
		class: "input input-bordered w-full focus:border-primary",
		"aria-invalid": $errors ? "true" : undefined,
		...$constraints,
		...rest
	}) satisfies HTMLInputAttributes;
</script>

<label for={field} class="label">
	<span class="label-text">
		{label}
		{#if commonProps.required}
			<span class="text-error">*</span>
		{/if}
	</span>
</label>
{#if type === "text"}
	<input
		type="text"
		{...commonProps}
		id={field}
		disabled={readonly}
		bind:value={$value}
		oninput={() => oninput?.($value)}
		onchange={() => onchange?.($value)}
	/>
{:else if type === "url"}
	<input
		type="url"
		{...commonProps}
		id={field}
		disabled={readonly}
		bind:value={$value}
		oninput={() => oninput?.($value)}
		onchange={() => onchange?.($value)}
	/>
{:else if type === "number"}
	<input
		type="number"
		{...commonProps}
		id={field}
		min={$proxyMin}
		max={$proxyMax}
		disabled={readonly}
		bind:value={$value}
		oninput={() => oninput?.($value)}
		onchange={() => onchange?.($value)}
	/>
{:else if type === "date"}
	<input
		type="datetime-local"
		{...commonProps}
		id={field}
		min={$proxyMin}
		max={$proxyMax}
		disabled={readonly}
		bind:value={$proxyDate}
		onchange={() => onchange?.($value)}
	/>
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
