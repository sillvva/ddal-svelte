<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec">
	import type { ExtractBrand } from "$lib/util";

	import { dev } from "$app/environment";
	import { Combobox } from "bits-ui";
	import SuperDebug, { formFieldProxy, stringProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";
	import { twMerge } from "tailwind-merge";

	export let superform: SuperForm<T, any>;
	export let valueField: ExtractBrand<FormPathLeaves<T>>;
	export let labelField = valueField;
	export let errorField = valueField;
	export let name = "";
	export let values: Array<{ value: string; label?: string; itemLabel?: string }> = [];
	export let allowCustom = false;
	export let showOnEmpty = false;
	export let clearable = false;
	export let disabled = false;
	export let required: true | undefined = undefined;
	export let link = "";
	export let description = "";
	export let placeholder = "";
	export let oninput = (el?: HTMLInputElement, value?: string) => {};
	export let onselect = (sel: { selected?: (typeof values)[number]; input: string }) => {};
	export let onclear = () => {};

	let debug = false;
	let open = false;
	let changed = false;

	const { constraints } = formFieldProxy(superform, labelField as any);
	const value = stringProxy(superform, valueField as any, { empty: "undefined" });
	const label = stringProxy(superform, labelField as any, { empty: "undefined" });
	const { errors } = formFieldProxy(superform, errorField as any);

	if ($constraints?.required) required = true;

	$: withLabel = values.map(({ value, label, itemLabel }) => ({
		value,
		label: label || value,
		itemLabel: itemLabel || label || value
	}));
	$: prefiltered = withLabel.filter((v) =>
		v.itemLabel
			.toLowerCase()
			.replace(/\s+/g, "")
			.includes(($label || "").toLowerCase().replace(/\s+/g, ""))
	);
	$: firstItem = { value: "", label: $label, itemLabel: `Add "${$label}"` };
	$: filtered = !$label?.trim() || !allowCustom || prefiltered.length === 1 ? prefiltered : [firstItem].concat(prefiltered);
	$: selectedItem = $value ? values.find((v) => v.value === $value) : $label.trim() && allowCustom ? firstItem : undefined;

	function clear() {
		$value = "";
		$label = "";
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
		$label = sel?.label || "";
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
			<slot />
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
						on:input={(e) => {
							let cValue = e.currentTarget.value;
							if (selectedItem && selectedItem.label !== cValue) selectedItem = undefined;
							if (!cValue) clear();
							$label = cValue;
							oninput(e.currentTarget, cValue);
							changed = true;
						}}
						on:blur={() => {
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
			<button class="btn join-item input-bordered" type="button" on:click|preventDefault={() => clear()}>
				<span class="iconify size-6 bg-red-500 mdi-close" />
			</button>
		{/if}
		{#if link}
			<a href={link} class="btn join-item input-bordered" role="button" target="_blank">
				<span class="iconify size-6 mdi-pencil" />
			</a>
		{/if}
		{#if dev}
			<button type="button" class="btn join-item input-bordered" on:click|preventDefault={() => (debug = !debug)}>
				<span class="iconify size-6 mdi-information-outline" />
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
