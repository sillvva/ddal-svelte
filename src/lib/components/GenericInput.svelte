<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { readable } from "svelte/store";
	import { formFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";

	interface $$Props {
		superform?: SuperForm<T>;
		field?: FormPathLeaves<T>;
		required?: HTMLInputAttributes["required"];
		label: string;
		labelFor?: string;
	}

	export let superform: SuperForm<T> | undefined = undefined;
	export let field: FormPathLeaves<T> | undefined = undefined;
	export let required: HTMLInputAttributes["required"] = false;
	export let label: string;
	export let labelFor = "";

	const { errors } = superform && field ? formFieldProxy(superform, field) : { errors: readable("") };
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
	<label for={labelFor || field} class="label">
		<span class="label-text-alt text-error">{$errors}</span>
	</label>
{/if}
