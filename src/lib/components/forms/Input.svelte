<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { dateProxy, formFieldProxy, numberProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";

	type T = $$Generic<Record<PropertyKey, unknown>>;
	type TType = $$Generic<"text" | "url" | "number" | "date">;
	type LeafType = TType extends "text" | "url"
		? string
		: TType extends "number"
			? number
			: TType extends "date"
				? Date
				: undefined;
	interface $$Props extends HTMLInputAttributes {
		superform: SuperForm<T>;
		field: FormPathLeaves<T, LeafType>;
		type: TType;
		empty?: TType extends "date" ? "null" | "undefined" : never;
		minField?: TType extends "number" | "date" ? FormPathLeaves<T, LeafType> : never;
		maxField?: TType extends "number" | "date" ? FormPathLeaves<T, LeafType> : never;
		readonly?: boolean;
		description?: string;
		oninput?: TType extends "string" | "url" | "number" ? (value: typeof $value) => void : never;
		onchange?: (value: typeof $value) => void;
	}

	export let superform: SuperForm<T>;
	export let field: FormPathLeaves<T, LeafType>;
	export let type: TType;
	export let empty: "null" | "undefined" = "null";
	export let minField: FormPathLeaves<T> | undefined = undefined;
	export let maxField: FormPathLeaves<T> | undefined = undefined;
	export let readonly: boolean | undefined = undefined;
	export let description = "";
	export let oninput = (value: typeof $value) => {};
	export let onchange = (value: typeof $value) => {};

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

	function disabled(node: HTMLInputElement) {
		if (readonly) node.setAttribute("disabled", "");
	}

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
	<input
		type="text"
		bind:value={$value}
		on:input={() => oninput($value)}
		on:change={() => onchange($value)}
		{...commonProps}
		use:disabled
	/>
{:else if type === "url"}
	<input
		type="url"
		bind:value={$value}
		on:input={() => oninput($value)}
		on:change={() => onchange($value)}
		{...commonProps}
		use:disabled
	/>
{:else if type === "number"}
	<input
		type="number"
		bind:value={$value}
		on:input={() => oninput($value)}
		on:change={() => onchange($value)}
		min={$proxyMin}
		max={$proxyMax}
		{...commonProps}
		use:disabled
	/>
{:else if type === "date"}
	<input
		type="datetime-local"
		bind:value={$proxyDate}
		on:change={() => onchange($value)}
		min={$proxyMin}
		max={$proxyMax}
		{...commonProps}
		use:disabled
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
