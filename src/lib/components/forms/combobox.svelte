<script lang="ts">
	import { dev } from "$app/env";
	import type { RemoteFormField } from "$app/server";
	import { Combobox } from "bits-ui";
	import Debug from "../debug.svelte";
	import FieldMessage from "./field-message.svelte";
	import Input from "./input.svelte";

	type Item = {
		value: string;
		label?: string;
		itemLabel?: string;
	};
	type WithLabel = Item & {
		label: string;
		itemLabel: string;
	};

	interface Props {
		valueField?: RemoteFormField<string>;
		inputField: RemoteFormField<string>;
		errorField?: RemoteFormField<string>;
		label: string;
		values?: Array<Item>;
		allowCustom?: boolean;
		showOnEmpty?: boolean;
		clearable?: boolean;
		disabled?: boolean;
		required?: boolean;
		link?: string;
		placeholder?: string;
		description?: string;
		oninput?: (el?: HTMLInputElement, value?: string) => void;
		onselect?: (sel: { selected?: (typeof values)[number]; input: string }) => void;
		onclear?: () => void;
		onblur?: (el?: HTMLInputElement) => void;
	}

	let {
		inputField,
		valueField = inputField,
		errorField = valueField,
		label,
		values = [],
		allowCustom = false,
		showOnEmpty = false,
		clearable = false,
		disabled = false,
		required = undefined,
		link = "",
		placeholder = "",
		oninput,
		onselect,
		onclear,
		onblur,
		description
	}: Props = $props();

	let debug = $state(false);
	let open = $state(false);
	let changed = $state(false);

	const input = $derived(inputField.value() || "");
	const attributes = $derived(inputField.as("text"));
	const name = $derived(attributes.name);
	const issues = $derived(errorField ? errorField.issues() : valueField?.issues());
	const invalid = $derived(!!issues?.length || undefined);
	const isValueField = $derived(valueField.as("text").name === inputField.as("text").name);

	const withLabel: WithLabel[] = $derived(
		values.map(({ value, label, itemLabel }) => ({
			value,
			label: label || value,
			itemLabel: itemLabel || label || value
		}))
	);
	const prefiltered = $derived(
		withLabel.filter((v) =>
			v.itemLabel
				.toLowerCase()
				.replace(/\s+/g, "")
				.includes((input || "").toLowerCase().replace(/\s+/g, ""))
		)
	);
	const firstItem = $derived<WithLabel>({ value: "", label: input, itemLabel: `Add ${input}` });
	const filtered = $derived(
		!input?.trim() || !allowCustom || prefiltered.length === 1 ? prefiltered : [firstItem].concat(prefiltered)
	);

	let selectedItem = $derived<Item | undefined>(
		valueField.value()
			? values.find((v) => v.value === valueField.value())
			: inputField.value()?.trim() && allowCustom
				? { value: "", label: inputField.value(), itemLabel: `Add ${inputField.value()}` }
				: undefined
	);

	function clear() {
		valueField?.set("");
		inputField.set("");
		selectedItem = undefined;
		onclear?.();
		open = false;
	}
</script>

<Combobox.Root
	items={filtered}
	type="single"
	bind:value={() => valueField.value(), (val) => valueField.set(val)}
	bind:open
	{disabled}
	onValueChange={(sel) => {
		const item = filtered.find((item) => item.value === sel);
		if (!isValueField) inputField.set(item?.label || item?.value || "");
		selectedItem = { value: item?.value || "", label: input, itemLabel: input };
		onselect?.({ selected: item, input });
		open = false;
	}}
	onOpenChange={() => {
		setTimeout(() => {
			if (!open) {
				if (changed) {
					if (!allowCustom && !selectedItem) clear();
					changed = false;
				}
			}
		}, 50);
	}}
>
	<label for={name} class="fieldset-legend">
		<span>
			{label}
			{#if required}
				<span class="text-error">*</span>
			{/if}
		</span>
		{#if dev}
			<button
				type="button"
				class="btn h-4.5 btn-ghost btn-xs"
				aria-label="Open Calendar"
				onclick={(ev) => {
					ev.preventDefault();
					debug = !debug;
				}}
			>
				<span class="iconify size-4 mdi--information-outline"></span>
			</button>
		{/if}
	</label>
	<div class="join">
		<div class="dropdown w-full">
			<label>
				<Combobox.Input
					id={name}
					oninput={(e) => {
						let cValue = e.currentTarget.value;
						if (!cValue) return clear();
						if (!isValueField) {
							inputField.set(cValue);
							valueField.set("");
						}
						oninput?.(e.currentTarget, cValue);
						changed = true;
					}}
					onblur={(ev) => {
						if (!allowCustom && !selectedItem && !filtered.length) clear();
						if (!input) open = false;
						onblur?.(ev.currentTarget);
					}}
					aria-invalid={issues?.length ? "true" : undefined}
					class="input join-item w-full focus:border-primary max-sm:text-base"
					{required}
					{placeholder}
				>
					{#snippet child({ props })}
						<input {...props} {...inputField.as("text")} aria-invalid={invalid} />
					{/snippet}
				</Combobox.Input>
			</label>
			{#if (showOnEmpty || input?.trim()) && filtered.length}
				<Combobox.ContentStatic class="menu dropdown-content z-10 w-full rounded-lg bg-base-200 p-2 shadow-sm">
					{#snippet child({ props })}
						<ul {...props}>
							{#each filtered.slice(0, 8) as item (item.value)}
								<Combobox.Item
									value={item.value}
									label={item.label}
									class={[
										"rounded-lg hover:bg-base-content/25",
										"data-highlighted:bg-base-content/25",
										"data-selected:bg-primary data-selected:font-bold data-selected:text-primary-content"
									]}
									role="option"
								>
									{#snippet child({ props })}
										<li {...props}>
											<span class="rounded-none px-4 py-2">
												{item.itemLabel}
											</span>
										</li>
									{/snippet}
								</Combobox.Item>
							{/each}
						</ul>
					{/snippet}
				</Combobox.ContentStatic>
			{/if}
		</div>
		{#if input && clearable}
			<button
				class="btn join-item border border-base-content/20 px-2"
				type="button"
				onclick={(ev) => {
					ev.preventDefault();
					clear();
				}}
				aria-label="Clear"
			>
				<span class="iconify size-6 bg-red-500 mdi--close"></span>
			</button>
		{/if}
		{#if link}
			<a href={link} class="btn join-item border border-base-content/20 px-2" role="button" target="_blank" aria-label="Edit">
				<span class="iconify size-6 mdi--pencil"></span>
			</a>
		{/if}
	</div>

	<FieldMessage {name} type="select" {description} {issues} />

	{#if !isValueField}
		<Input field={valueField} hidden />
	{/if}
</Combobox.Root>

{#if debug}
	<Debug data={selectedItem} />
{/if}
