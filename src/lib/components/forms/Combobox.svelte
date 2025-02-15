<script lang="ts">
	import { dev } from "$app/environment";
	import { Combobox } from "bits-ui";
	import SuperDebug, { formFieldProxy, stringProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";

	type T = $$Generic<Record<PropertyKey, unknown>>;
	type Item = {
		value: string;
		label: string;
		itemLabel?: string;
	};
	interface Props {
		superform: SuperForm<T>;
		valueField: FormPathLeaves<T>;
		inputField: FormPathLeaves<T, string>;
		errorField?: FormPathLeaves<T, string>;
		label: string;
		name?: string;
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
		superform,
		valueField,
		inputField,
		errorField = valueField,
		label,
		name = "",
		values = [],
		allowCustom = false,
		showOnEmpty = false,
		clearable = false,
		disabled = false,
		required = undefined,
		link = "",
		placeholder = "",
		oninput = (el?: HTMLInputElement, value?: string) => {},
		onselect = (sel: { selected?: (typeof values)[number]; input: string }) => {},
		onclear = () => {},
		description
	}: Props = $props();

	let debug = $state(false);
	let open = $state(false);
	let changed = $state(false);

	const { constraints } = formFieldProxy(superform, inputField);
	const value = stringProxy(superform, valueField, { empty: "undefined" });
	const input = stringProxy(superform, inputField, { empty: "undefined" });
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
				.includes(($input || "").toLowerCase().replace(/\s+/g, ""))
		)
	);
	const firstItem = $derived<Item>({ value: "", label: $input, itemLabel: `Add "${$input}"` });
	const filtered = $derived(
		!$input?.trim() || !allowCustom || prefiltered.length === 1 ? prefiltered : [firstItem].concat(prefiltered)
	);

	let selectedItem = $state<Item | undefined>(
		$value
			? values.find((v) => v.value === $value)
			: $input.trim() && allowCustom
				? { value: "", label: $input, itemLabel: `Add "${$input}"` }
				: undefined
	);

	function clear() {
		$value = "";
		$input = "";
		selectedItem = undefined;
		onclear();
		open = false;
	}
</script>

<Combobox.Root
	items={filtered}
	type="single"
	bind:value={$value}
	bind:open
	{name}
	{disabled}
	{required}
	onValueChange={(sel) => {
		const item = filtered.find((item) => item.value === sel);
		$value = item?.value || "";
		$input = item?.label || item?.value || "";
		selectedItem = { value: $value, label: $input, itemLabel: $input };
		onselect({ selected: item, input: $input });
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
	<label for={inputField} class="fieldset-legend">
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
				<Combobox.Input>
					{#snippet child({ props })}
						<input
							class="input join-item focus:border-primary w-full"
							{...props}
							bind:value={$input}
							id={inputField}
							oninput={(e) => {
								let cValue = e.currentTarget.value;
								if (selectedItem && selectedItem.label !== cValue) selectedItem = undefined;
								if (!cValue) clear();
								$input = cValue;
								oninput(e.currentTarget, cValue);
								changed = true;
							}}
							onblur={() => {
								if (!allowCustom && !selectedItem && !filtered.length) clear();
								if (!$input) open = false;
							}}
							aria-invalid={($errors || []).length ? "true" : undefined}
							{required}
							{placeholder}
						/>
					{/snippet}
				</Combobox.Input>
			</label>
			{#if (showOnEmpty || $input?.trim()) && filtered.length}
				<Combobox.Content>
					{#snippet child({ props })}
						<ul class="menu dropdown-content bg-base-200 z-10 w-full rounded-lg p-2 shadow-sm" {...props}>
							{#each filtered.slice(0, 8) as item}
								<Combobox.Item value={item.value} label={item.label}>
									{#snippet child({ props })}
										<li
											class={[
												"hover:bg-primary/50",
												"data-highlighted:bg-primary data-highlighted:text-primary-content",
												"data-selected:bg-primary data-selected:text-primary-content data-selected:font-bold"
											].join(" ")}
											{...props}
											role="option"
											data-selected={selectedItem?.value === item.value ? "true" : undefined}
											aria-selected={selectedItem?.value === item.value}
										>
											<span class="rounded-none px-4 py-2">
												{item.itemLabel}
											</span>
										</li>
									{/snippet}
								</Combobox.Item>
							{/each}
						</ul>
					{/snippet}
				</Combobox.Content>
			{/if}
		</div>
		{#if $input && clearable}
			<button
				class="btn join-item border-base-content/20 border"
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
			<a href={link} class="btn join-item border-base-content/20 border" role="button" target="_blank" aria-label="Edit">
				<span class="iconify mdi--pencil size-6"></span>
			</a>
		{/if}
		{#if dev}
			<button
				type="button"
				class="btn join-item border-base-content/20 border"
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
	{#if $errors?.length || description}
		<label for={inputField} class="fieldset-label">
			{#if $errors?.length}
				<span class="text-error">{$errors[0]}</span>
			{:else}
				<span class="text-neutral-500">{description}</span>
			{/if}
		</label>
	{/if}
</Combobox.Root>

{#if debug}
	<SuperDebug data={selectedItem} />
{/if}
