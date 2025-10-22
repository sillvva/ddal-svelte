<script lang="ts">
	import type { RemoteFormField, RemoteFormFieldType } from "@sveltejs/kit";
	import type { Snippet } from "svelte";
	import type { HTMLInputAttributes } from "svelte/elements";

	interface Props {
		field: RemoteFormField<string>;
		as: RemoteFormFieldType<string>;
		required?: HTMLInputAttributes["required"];
		label: string;
		children?: Snippet;
	}

	let { field, as, required = false, label, children }: Props = $props();

	// @ts-expect-error expected
	const attributes = $derived(field.as(as));
	const name = $derived(attributes.name);

	const issues = $derived(field.issues());
</script>

<label for={name} class="fieldset-legend">
	<span>
		{label}
		{#if required}
			<span class="text-error">*</span>
		{/if}
	</span>
</label>
{@render children?.()}
{#if issues?.length}
	<label for={name} class="fieldset-label">
		<span class="text-error">{issues[0]}</span>
	</label>
{/if}
