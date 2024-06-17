<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { readable } from "svelte/store";
	import { formFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";

	type T = $$Generic<Record<PropertyKey, unknown>>;

	export let superform: SuperForm<T> | undefined = undefined;
	export let field: FormPathLeaves<T> | undefined = undefined;
	export let required: HTMLInputAttributes["required"] = false;
	export let label: string;
	export let labelFor = "";
	export let fieldErrors: string[] = [];

	const { errors } = superform && field ? formFieldProxy(superform, field) : { errors: readable(fieldErrors) };
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
{#if $errors?.length}
	<label for={labelFor || field} class="label">
		<span class="label-text-alt text-error">{$errors}</span>
	</label>
{/if}
