<script lang="ts">
	import { dev } from "$app/environment";
	import type { RemoteFormField } from "@sveltejs/kit";
	import { Combobox } from "bits-ui";
	import SuperDebugRuned from "sveltekit-superforms/SuperDebug.svelte";
	import RemoteFieldMessage from "./remote-field-message.svelte";
	import RemoteInput from "./remote-input.svelte";

	type Item = {
		value: string;
		label: string;
		itemLabel?: string;
	};
	interface Props {
		valueField: RemoteFormField<string>;
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
	}

	let {
		valueField,
		inputField,
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
		description
	}: Props = $props();

	let debug = $state(false);
	let open = $state(false);
	let changed = $state(false);

	const input = $derived(inputField.value());
	const attributes = $derived(valueField.as("select"));
	const name = $derived(attributes.name);
	const issues = $derived(errorField ? errorField.issues() : valueField.issues());
	const invalid = $derived(!!issues?.length || undefined);

	const withLabel = $derived(
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
	const firstItem = $derived<Item>({ value: "", label: input, itemLabel: `Add ${input}` });
	const filtered = $derived(
		!input?.trim() || !allowCustom || prefiltered.length === 1 ? prefiltered : [firstItem].concat(prefiltered)
	);

	let selectedItem = $state<Item | undefined>(
		valueField.value()
			? values.find((v) => v.value === valueField.value())
			: inputField.value()?.trim() && allowCustom
				? { value: "", label: inputField.value(), itemLabel: `Add ${inputField.value()}` }
				: undefined
	);

	function clear() {
		valueField.set("");
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
		inputField.set(item?.label || item?.value || "");
		selectedItem = { value: item?.value || "", label: input, itemLabel: input };
		onselect?.({ selected: item, input: input });
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
	</label>
	<div class="join">
		<div class="dropdown w-full">
			<label>
				<Combobox.Input
					id={name}
					oninput={(e) => {
						let cValue = e.currentTarget.value;
						if (!cValue) return clear();
						inputField.set(cValue);
						valueField.set("");
						oninput?.(e.currentTarget, cValue);
						changed = true;
					}}
					onblur={() => {
						if (!allowCustom && !selectedItem && !filtered.length) clear();
						if (!input) open = false;
					}}
					aria-invalid={issues?.length ? "true" : undefined}
					class="input join-item focus:border-primary w-full"
					{required}
					{placeholder}
				>
					{#snippet child({ props })}
						<input {...props} {...inputField.as("text")} aria-invalid={invalid} />
					{/snippet}
				</Combobox.Input>
			</label>
			{#if (showOnEmpty || input?.trim()) && filtered.length}
				<Combobox.ContentStatic class="menu dropdown-content bg-base-200 z-10 w-full rounded-lg p-2 shadow-sm">
					{#snippet child({ props })}
						<ul {...props}>
							{#each filtered.slice(0, 8) as item (item.value)}
								<Combobox.Item
									value={item.value}
									label={item.label}
									class={[
										"hover:bg-base-content/25 rounded-lg",
										"data-highlighted:bg-base-content/25",
										"data-selected:bg-primary data-selected:text-primary-content data-selected:font-bold"
									].join(" ")}
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
				class="btn join-item border-base-content/20 border px-2"
				type="button"
				onclick={(ev) => {
					ev.preventDefault();
					clear();
				}}
				aria-label="Clear"
			>
				<span class="iconify mdi--close size-6 bg-red-500"></span>
			</button>
		{/if}
		{#if link}
			<a href={link} class="btn join-item border-base-content/20 border px-2" role="button" target="_blank" aria-label="Edit">
				<span class="iconify mdi--pencil size-6"></span>
			</a>
		{/if}
		{#if dev}
			<button
				type="button"
				class="btn join-item border-base-content/20 border px-2"
				onclick={(ev) => {
					ev.preventDefault();
					debug = !debug;
				}}
				aria-label="Debug"
			>
				<span class="iconify mdi--information-outline size-6"></span>
			</button>
		{/if}
	</div>
	<RemoteFieldMessage {name} type="select" {description} {issues} />
	<RemoteInput field={valueField} type="hidden" />
</Combobox.Root>

{#if debug}
	<SuperDebugRuned data={selectedItem} />
{/if}
