<script lang="ts">
	import type { RemoteFormField, RemoteFormFieldType, RemoteFormFieldValue } from "@sveltejs/kit";
	import type { Snippet } from "svelte";
	import type { HTMLInputAttributes } from "svelte/elements";
	import FieldMessage from "./field-message.svelte";

	interface Props {
		label?: string;
		description?: string;
		warning?: string;
		required?: HTMLInputAttributes["required"];
		children?: Snippet;
	}

	interface GenericFieldProps extends Props {
		field: RemoteFormField<string>;
		as: RemoteFormFieldType<string>;
	}

	interface GenericProps extends Props {
		type: RemoteFormFieldType<RemoteFormFieldValue>;
		labelFor?: string;
		fieldErrors?: string[];
	}

	let { label, description, warning, required = false, children, ...props }: GenericFieldProps | GenericProps = $props();

	const name = $derived("field" in props ? props.field.as("text").name : "labelFor" in props ? props.labelFor : undefined);
	const type = $derived("as" in props ? props.as : "type" in props ? props.type : "text");
	const issues = $derived(
		"field" in props
			? props.field.issues()
			: "fieldErrors" in props
				? props.fieldErrors?.map((error) => ({ message: error }))
				: undefined
	);
</script>

{#if label && type !== "hidden"}
	<label for={name} class="fieldset-legend">
		<span>
			{label}
			{#if required}
				<span class="text-error">*</span>
			{/if}
		</span>
	</label>
{/if}
{@render children?.()}
<FieldMessage {name} {type} {description} {warning} {issues} />
