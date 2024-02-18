<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { dateProxy, formFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";

	interface $$Props extends HTMLInputAttributes {
		superform: SuperForm<T, any>;
		field: FormPathLeaves<T>;
		empty?: "null" | "undefined";
		minField?: FormPathLeaves<T>;
		maxField?: FormPathLeaves<T>;
	}

	export let superform: SuperForm<T, any>;
	export let field: FormPathLeaves<T>;
	export let empty: "null" | "undefined" = "null";
	export let minField: FormPathLeaves<T> | undefined = undefined;
	export let maxField: FormPathLeaves<T> | undefined = undefined;

	const proxyDate = dateProxy(superform, field, { format: "datetime-local", empty });
	const proxyMinDate = minField ? dateProxy(superform, minField, { format: "datetime-local" }) : undefined;
	const proxyMaxDate = maxField ? dateProxy(superform, maxField, { format: "datetime-local" }) : undefined;

	const { errors, constraints } = formFieldProxy(superform, field);
</script>

<label for={field} class="label">
	<span class="label-text">
		<slot />
		{#if $$props.required}
			<span class="text-error">*</span>
		{/if}
	</span>
</label>
<input
	type="datetime-local"
	bind:value={$proxyDate}
	class="input input-bordered w-full focus:border-primary"
	aria-invalid={$errors ? "true" : undefined}
	min={$proxyMinDate}
	max={$proxyMaxDate}
	{...$constraints}
	{...$$restProps}
/>
{#if $errors}
	<label for={field} class="label">
		<span class="label-text-alt text-error">{$errors}</span>
	</label>
{/if}
