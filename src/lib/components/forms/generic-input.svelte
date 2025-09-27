<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { readable } from "svelte/store";
	import { formFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";

	type T = $$Generic<Record<PropertyKey, unknown>>;
	interface Props {
		superform?: SuperForm<T>;
		field?: FormPathLeaves<T>;
		required?: HTMLInputAttributes["required"];
		label: string;
		labelFor?: string;
		fieldErrors?: string[];
		children?: Snippet;
	}

	let { superform, field, required = false, label, labelFor = "", fieldErrors = [], children }: Props = $props();

	const { errors } = superform && field ? formFieldProxy(superform, field) : { errors: readable(fieldErrors) };
</script>

<label for={labelFor || field} class="fieldset-legend">
	<span>
		{label}
		{#if required}
			<span class="text-error">*</span>
		{/if}
	</span>
</label>
{@render children?.()}
{#if $errors?.length}
	<label for={labelFor || field} class="fieldset-label">
		<span class="text-error">{$errors}</span>
	</label>
{/if}
