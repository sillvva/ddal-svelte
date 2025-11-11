<script lang="ts" generics="V extends RemoteFormFieldValue">
	import type { RemoteFormField, RemoteFormFieldValue } from "@sveltejs/kit";
	import type { HTMLInputAttributes } from "svelte/elements";
	import RemoteFieldMessage from "./remote-field-message.svelte";

	type InputTypeMap =
		| {
				type?: "text";
				value?: string;
				field: RemoteFormField<string>;
		  }
		| {
				type: "email" | "password" | "url" | "tel" | "search" | "button" | "reset" | "color";
				value?: string;
				field: RemoteFormField<string>;
		  }
		| { type: "number"; value?: number; field: RemoteFormField<number> }
		| { type: "range"; value?: number; field: RemoteFormField<number> }
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
				type: "hidden";
				value?: string;
				field: RemoteFormField<string>;
		  }
		| {
				type: "submit";
				value: string;
				field: RemoteFormField<string>;
		  }
		| {
				type: "button";
				value?: string;
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
		...(map.type === "hidden"
			? map.field.as(map.type, typeof map.value === "string" ? map.value : map.field.value() || "")
			: map.type === "checkbox" && typeof map.value === "string"
				? map.field.as("checkbox", map.value)
				: map.type === "radio" || map.type === "submit"
					? map.field.as(map.type, map.value)
					: map.type === "number" || map.type === "range"
						? map.field.as(map.type)
						: map.type === "file"
							? map.field.as(map.type)
							: map.type === "file multiple"
								? map.field.as(map.type)
								: map.type === "checkbox"
									? map.field.as("checkbox")
									: map.field.as(map.type || "text"))
	});
	const name = $derived(attributes.name);
	const issues = $derived(map.field.issues());
	const invalid = $derived(!!issues?.length || undefined);
</script>

{#if map.type === "checkbox"}
	<label
		class={[
			"label flex cursor-pointer rounded-lg border p-4 text-sm",
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
			<RemoteFieldMessage {name} type="checkbox" {description} {warning} {issues} />
		</div>
		<input {...attributes} aria-invalid={invalid} id={name} type="checkbox" class="checkbox-primary checkbox" />
	</label>
{:else}
	{#if map.type !== "hidden" && !hidden}
		<label for={name} class="fieldset-legend">
			<span>
				{label}
				{#if required}
					<span class="text-error">*</span>
				{/if}
			</span>
		</label>
	{/if}
	<input
		{...attributes}
		aria-invalid={invalid}
		id={name}
		class={[map.type !== "hidden" && !hidden && "input focus:border-primary focus:aria-[invalid]:border-error w-full"]}
		{hidden}
	/>
	<RemoteFieldMessage {name} type={hidden ? "hidden" : map.type || "text"} {description} {warning} {issues} />
{/if}
