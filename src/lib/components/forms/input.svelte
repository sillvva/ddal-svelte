<script lang="ts" generics="V extends RemoteFormFieldValue">
	import type { RemoteFormField, RemoteFormFieldValue } from "$app/server";
	import type { HTMLInputAttributes } from "svelte/elements";
	import FieldMessage from "./field-message.svelte";
	import InputWrapper from "./input-wrapper.svelte";

	type InputTypeMap =
		| { type?: "text"; field: RemoteFormField<string>; value?: string }
		| {
				type: "email" | "password" | "url" | "tel" | "search" | "button" | "reset" | "color" | "button" | "hidden";
				field: RemoteFormField<string>;
				value?: string;
		  }
		| { type: "number"; field: RemoteFormField<number>; value?: number }
		| { type: "range"; field: RemoteFormField<number>; value?: number }
		| {
				type: "checkbox";
				value?: boolean;
				field: RemoteFormField<boolean>;
		  }
		| {
				type: "checkbox";
				value: string;
				field: RemoteFormField<string[]>;
		  }
		| {
				type: "radio";
				value: string;
				field: RemoteFormField<string>;
		  }
		| {
				type: "submit";
				value: string;
				field: RemoteFormField<string>;
		  }
		| {
				type: "file";
				field: RemoteFormField<File>;
		  }
		| {
				type: "file multiple";
				field: RemoteFormField<File[]>;
		  };

	type Props = {
		label?: string;
		field: RemoteFormField<V>;
		description?: string;
		warning?: string;
		hidden?: boolean;
	} & InputTypeMap &
		Omit<HTMLInputAttributes, "type" | "name" | "id" | "value" | "checked" | "defaultValue" | "defaultChecked">;

	let { label, description, warning, hidden, required, ...rest }: Props = $props();

	const map: InputTypeMap = $derived(rest);
	const attributes = $derived({
		...rest,
		field: undefined,
		...(map.type === "checkbox"
			? typeof map.value === "string"
				? map.field.as("checkbox", map.value)
				: map.field.as("checkbox", map.value)
			: map.type === "radio" || map.type === "submit"
				? map.field.as(map.type, map.value)
				: map.type === "number" || map.type === "range"
					? map.field.as(map.type, map.field.value() ?? map.value)
					: map.type === "file"
						? map.field.as(map.type)
						: map.type === "file multiple"
							? map.field.as(map.type)
							: map.field.as(map.type || "text", map.field.value() ?? map.value ?? ""))
	});
	const name = $derived(attributes.name);
	const issues = $derived(map.field.issues());
	const invalid = $derived(!!issues?.length || undefined);
</script>

{#if map.type === "checkbox"}
	<label
		class={[
			"label flex cursor-pointer rounded-lg border p-4 text-sm max-sm:text-base",
			invalid ? "border-error" : "border-base-content/20",
			hidden && "hidden"
		]}
	>
		<div class="flex flex-1 flex-col gap-0.5">
			<span>
				<span class="text-base-content">{label}</span>
				{#if required}
					<span class="text-error">*</span>
				{/if}
			</span>

			<FieldMessage {name} type="checkbox" {description} {warning} {issues} />
		</div>
		<input {...attributes} aria-invalid={invalid} id={name} type="checkbox" class="checkbox checkbox-primary" />
	</label>
{:else}
	<InputWrapper
		type={hidden ? "hidden" : map.type || "text"}
		{label}
		labelFor={name}
		{required}
		fieldErrors={issues?.map((issue) => issue.message)}
	>
		<input
			{...attributes}
			aria-invalid={invalid}
			id={name}
			class={[
				map.type !== "hidden" &&
					!hidden &&
					"input w-full user-invalid:border-error focus:border-primary focus:aria-[invalid]:border-error max-sm:text-base"
			]}
			autocomplete={rest.autocomplete || "off"}
			{required}
			{hidden}
		/>
	</InputWrapper>
{/if}
