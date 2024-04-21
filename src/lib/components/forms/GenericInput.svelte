<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec">
	import type { IncludeBrandedFormPathLeaves } from "$lib/util";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { readable } from "svelte/store";
	import { formFieldProxy, type SuperForm } from "sveltekit-superforms";

	export let superform: SuperForm<T> | undefined = undefined;
	export let field: IncludeBrandedFormPathLeaves<T> | undefined = undefined;
	export let required: HTMLInputAttributes["required"] = false;
	export let label: string;
	export let labelFor = "";
	export let fieldErrors: string[] = [];

	const { errors } = superform && field ? formFieldProxy(superform, field as any) : { errors: readable(fieldErrors) };
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
