<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec">
	import { dev } from "$app/environment";
	import { Combobox } from "bits-ui";
	import { createEventDispatcher } from "svelte";
	import SuperDebug, { formFieldProxy, stringProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";
	import { twMerge } from "tailwind-merge";
	import Icon from "./Icon.svelte";

	export let superform: SuperForm<T, any>;
	export let idField: FormPathLeaves<T>;
	export let field: FormPathLeaves<T> = idField;
	export let errorField: FormPathLeaves<T> = field;
	export let name = "";
	export let values: Array<{ value: string; label?: string; itemLabel?: string }> = [];
	export let allowCustom = false;
	export let showOnEmpty = false;
	export let clearable = false;
	export let disabled = false;
	export let required = false;

	let debug = false;
	let open = false;
	let changed = false;

	let inputValue = "";
	const { errors } = formFieldProxy(superform, errorField);
	const idValue = stringProxy(superform, idField, { empty: "null" });
	const value = stringProxy(superform, field, { empty: "null" });

	const dispatch = createEventDispatcher<{
		input: void;
		select: { selected: (typeof values)[number] | undefined; input: string } | undefined;
		clear: void;
	}>();

	$: withLabel = values.map(({ value, label, itemLabel }) => ({
		value,
		label: label || value,
		itemLabel: itemLabel || label || value
	}));
	$: prefiltered = withLabel.filter((v) =>
		v.itemLabel
			.toLowerCase()
			.replace(/\s+/g, "")
			.includes(($value || "").toLowerCase().replace(/\s+/g, ""))
	);
	$: filtered =
		!$value?.trim() || !allowCustom || prefiltered.length === 1
			? prefiltered
			: [{ value: $value, label: $value, itemLabel: `Add "${$value}"` }, ...prefiltered];
	$: selectedItem = $idValue
		? values.find((v) => v.value === $idValue)
		: $value.trim() && allowCustom
			? { value: "", label: $value, itemLabel: `Add "${$value}"` }
			: undefined;
	$: if ($idValue) inputValue = selectedItem?.label || "";
	$: if (!$idValue) inputValue = "";
</script>

<Combobox.Root
	items={filtered}
	bind:inputValue
	bind:open
	let:ids
	{disabled}
	{required}
	onSelectedChange={(sel) => {
		dispatch("select", { selected: sel, input: inputValue });
	}}
	onOpenChange={() => {
		setTimeout(() => {
			if (!open) {
				if (changed) {
					dispatch("select", { selected: selectedItem, input: inputValue });
					if (!allowCustom && !selectedItem) inputValue = "";
					changed = false;
				}
			}
		}, 50);
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
						on:input={() => {
							changed = true;
							dispatch("input");
							if (selectedItem && selectedItem.label !== inputValue) {
								selectedItem = undefined;
							}
							if (!inputValue) {
								dispatch("clear");
								selectedItem = undefined;
							}
						}}
						on:blur={() => {
							if (!filtered.length) dispatch("select", { selected: undefined, input: inputValue });
						}}
						aria-invalid={($errors || []).length ? "true" : undefined}
						use:builder.action
						{...builder}
					/>
				</Combobox.Input>
			</label>
			{#if (showOnEmpty || inputValue?.trim()) && filtered.length}
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
		{#if inputValue && selectedItem && clearable}
			<button
				class="btn join-item input-bordered"
				type="button"
				on:click|preventDefault={() => {
					dispatch("clear");
					selectedItem = undefined;
					inputValue = "";
					$idValue = "";
					$value = "";
				}}
			>
				<Icon src="x" class="w-6" color="red" />
			</button>
		{/if}
		{#if dev}
			<button type="button" class="btn join-item input-bordered" on:click|preventDefault={() => (debug = !debug)}>
				<Icon src="info" class="w-6" />
			</button>
		{/if}
	</div>
	{#if name}<Combobox.HiddenInput {name} />{/if}
	{#if $errors}
		<label for={ids.trigger} class="label">
			<span class="label-text-alt text-error">{$errors}</span>
		</label>
	{/if}
</Combobox.Root>

{#if debug}
	<SuperDebug data={selectedItem} />
{/if}
