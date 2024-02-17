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
		label: string;
		labelFor?: FormPathLeaves<T>;
	}

	export let superform: SuperForm<T>;
	export let field: FormPathLeaves<T>;
	export let required = false;
	export let label: string = "Field";
	export let labelFor: FormPathLeaves<T> | undefined = undefined;

	const { errors } = formFieldProxy(superform, field);
</script>

<label for={labelFor || field} class="label">
	<span class="label-text">
		{label}
		{#if required}
			<span class="text-error">*</span>
		{/if}
	</span>
</label>
<slot />
{#if $errors}
	<label for="name" class="label">
		<span class="label-text-alt text-error">{$errors}</span>
	</label>
{/if}
