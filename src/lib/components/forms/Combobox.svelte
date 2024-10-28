<script lang="ts">
	import { dev } from "$app/environment";
	import { Combobox } from "bits-ui";
	import type { Snippet } from "svelte";
	import SuperDebug, { formFieldProxy, stringProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";
	import { twMerge } from "tailwind-merge";

	type T = $$Generic<Record<PropertyKey, unknown>>;
	type Item = {
		value: string;
		label?: string;
		itemLabel?: string;
	};
	interface Props {
		superform: SuperForm<T>;
		valueField: FormPathLeaves<T>;
		labelField: FormPathLeaves<T, string>;
		errorField?: FormPathLeaves<T, string>;
		name?: string;
		values?: Array<Item>;
		allowCustom?: boolean;
		showOnEmpty?: boolean;
		clearable?: boolean;
		disabled?: boolean;
		required?: boolean;
		link?: string;
		description?: string;
		placeholder?: string;
		oninput?: (el?: HTMLInputElement, value?: string) => void;
		onselect?: (sel: { selected?: (typeof values)[number]; input: string }) => void;
		onclear?: () => void;
		children?: Snippet;
	}

	let {
		superform,
		valueField,
		labelField,
		errorField = valueField,
		name = "",
		values = [],
		allowCustom = false,
		showOnEmpty = false,
		clearable = false,
		disabled = false,
		required = undefined,
		link = "",
		description = "",
		placeholder = "",
		oninput = (el?: HTMLInputElement, value?: string) => {},
		onselect = (sel: { selected?: (typeof values)[number]; input: string }) => {},
		onclear = () => {},
		children
	}: Props = $props();

	let debug = $state(false);
	let open = $state(false);
	let changed = $state(false);

	const { constraints } = formFieldProxy(superform, labelField);
	const value = stringProxy(superform, valueField, { empty: "undefined" });
	const label = stringProxy(superform, labelField, { empty: "undefined" });
	const { errors } = formFieldProxy(superform, errorField);

	if ($constraints?.required) required = true;

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
				.includes(($label || "").toLowerCase().replace(/\s+/g, ""))
		)
	);
	const firstItem = $derived<Item>({ value: "", label: $label, itemLabel: `Add "${$label}"` });
	const filtered = $derived(
		!$label?.trim() || !allowCustom || prefiltered.length === 1 ? prefiltered : [firstItem].concat(prefiltered)
	);

	let selectedItem = $state<Item | undefined>(
		$value
			? values.find((v) => v.value === $value)
			: $label.trim() && allowCustom
				? { value: "", label: $label, itemLabel: `Add "${$label}"` }
				: undefined
	);

	function clear() {
		$value = "";
		$label = "";
		selectedItem = undefined;
		onclear();
		open = false;
	}
</script>

<Combobox.Root
	items={filtered}
	bind:inputValue={$label}
	bind:open
	let:ids
	{disabled}
	{required}
	onSelectedChange={(sel) => {
		$value = sel?.value || "";
		$label = sel?.label || sel?.value || "";
		selectedItem = { value: $value, label: $label, itemLabel: $label };
		onselect({ selected: sel, input: $label });
	}}
	preventScroll={false}
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
	onOutsideClick={() => {
		open = false;
	}}
>
	<label for={ids.trigger} class="label">
		<span class="label-text">
			{@render children?.()}
			{#if required}
				<span class="text-error">*</span>
			{/if}
		</span>
	</label>
	<div class="join">
		<div class="dropdown w-full">
			<label>
				<Combobox.Input asChild let:builder>
					<input
						class="input join-item input-bordered w-full focus:border-primary"
						oninput={(e) => {
							let cValue = e.currentTarget.value;
							if (selectedItem && selectedItem.label !== cValue) selectedItem = undefined;
							if (!cValue) clear();
							$label = cValue;
							oninput(e.currentTarget, cValue);
							changed = true;
						}}
						onblur={() => {
							if (!allowCustom && !selectedItem && !filtered.length) clear();
							if (!$label) open = false;
						}}
						aria-invalid={($errors || []).length ? "true" : undefined}
						use:builder.action
						{...builder}
						{required}
						{placeholder}
					/>
				</Combobox.Input>
			</label>
			{#if (showOnEmpty || $label?.trim()) && filtered.length}
				<Combobox.Content asChild let:builder>
					<ul class="menu dropdown-content z-10 w-full rounded-lg bg-base-200 p-2 shadow" use:builder.action {...builder}>
						{#each filtered.slice(0, 8) as item}
							<Combobox.Item asChild value={item.value} label={item.label} let:builder>
								<li
									class={twMerge(
										"hover:bg-primary/50",
										"data-[highlighted]:bg-primary data-[highlighted]:text-primary-content",
										"data-[selected]:bg-primary data-[selected]:font-bold data-[selected]:text-primary-content"
									)}
									use:builder.action
									{...builder}
									role="option"
									data-selected={selectedItem?.value === item.value ? "true" : undefined}
									aria-selected={selectedItem?.value === item.value}
								>
									<span class="rounded-none px-4 py-2">
										{item.itemLabel}
									</span>
								</li>
							</Combobox.Item>
						{/each}
					</ul>
				</Combobox.Content>
			{/if}
		</div>
		{#if $label && clearable}
			<button
				class="btn join-item input-bordered"
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
			<a href={link} class="btn join-item input-bordered" role="button" target="_blank" aria-label="Edit">
				<span class="iconify size-6 mdi--pencil"></span>
			</a>
		{/if}
		{#if dev}
			<button
				type="button"
				class="btn join-item input-bordered"
				onclick={(ev) => {
					ev.preventDefault();
					debug = !debug;
				}}
				aria-label="Debug"
			>
				<span class="iconify size-6 mdi--information-outline"></span>
			</button>
		{/if}
	</div>
	{#if name}<Combobox.HiddenInput {name} />{/if}
	{#if $errors?.length || description}
		<label for={labelField} class="label">
			{#if $errors?.length}
				<span class="label-text-alt text-error">{$errors[0]}</span>
			{:else}
				<span class="label-text-alt text-neutral-500">{description}</span>
			{/if}
		</label>
	{/if}
</Combobox.Root>

{#if debug}
	<SuperDebug data={selectedItem} />
{/if}
