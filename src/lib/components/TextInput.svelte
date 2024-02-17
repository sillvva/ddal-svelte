<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { formFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";

	interface $$Props extends HTMLInputAttributes {
		superform: SuperForm<T>;
		field: FormPathLeaves<T>;
		required?: boolean;
	}

	export let superform: SuperForm<T>;
	export let field: FormPathLeaves<T>;
	export let required = false;

	const { value, errors, constraints } = formFieldProxy(superform, field);
</script>

<label for={field} class="label">
	<span class="label-text">
		<slot />
		{#if required}
			<span class="text-error">*</span>
		{/if}
	</span>
</label>
<input
	type="text"
	name={field}
	id={field}
	{required}
	bind:value={$value}
	class="input input-bordered w-full focus:border-primary"
	aria-invalid={$errors ? "true" : undefined}
	{...$constraints}
	{...$$restProps}
/>
{#if $errors}
	<label for="name" class="label">
		<span class="label-text-alt text-error">{$errors}</span>
	</label>
{/if}
