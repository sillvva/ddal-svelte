<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec">
	import { createEventDispatcher } from "svelte";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { formFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";

	type InputType = "text" | "number";
	interface $$Props extends HTMLInputAttributes {
		superform: SuperForm<T>;
		field: FormPathLeaves<T>;
		type: InputType;
	}

	export let superform: SuperForm<T>;
	export let field: FormPathLeaves<T>;
	export let type: InputType = "text";

	const { value, errors, constraints } = formFieldProxy(superform, field);

	$: commonProps = {
		id: field,
		class: "input input-bordered w-full focus:border-primary",
		"aria-invalid": $errors ? "true" : undefined,
		...$constraints,
		...$$restProps
	} satisfies HTMLInputAttributes;

	const dispatch = createEventDispatcher<{
		input: typeof $value;
	}>();

	const inputHandler = () => dispatch("input", $value);
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
	<input type="text" bind:value={$value} on:input={inputHandler} {...commonProps} />
{:else if type === "number"}
	<input type="number" bind:value={$value} on:input={inputHandler} {...commonProps} />
{/if}
{#if $errors?.length}
	<label for={field} class="label">
		<span class="label-text-alt text-error">{$errors}</span>
	</label>
{/if}
