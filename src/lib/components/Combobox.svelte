<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec">
	import { dev } from "$app/environment";
	import { Combobox } from "bits-ui";
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
	export let link = "";
	export let oninput = (el?: HTMLInputElement, value?: string) => {};
	export let onselect = (sel: { selected?: (typeof values)[number]; input: string }) => {};
	export let onclear = () => {};

	let debug = false;
	let open = false;
	let changed = false;

	const idValue = stringProxy(superform, idField, { empty: "undefined" });
	const value = stringProxy(superform, field, { empty: "undefined" });
	const { errors } = formFieldProxy(superform, errorField);

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
			: [{ value: "", label: $value, itemLabel: `Add "${$value}"` }, ...prefiltered];
	$: selectedItem = $idValue
		? values.find((v) => v.value === $idValue)
		: $value.trim() && allowCustom
			? { value: "", label: $value, itemLabel: `Add "${$value}"` }
			: undefined;

	function clear() {
		$idValue = "";
		$value = "";
		onclear();
		open = false;
	}
</script>

<Combobox.Root
	items={filtered}
	bind:inputValue={$value}
	bind:open
	let:ids
	{disabled}
	{required}
	onSelectedChange={(sel) => {
		$idValue = sel?.value || "";
		$value = sel?.label || "";
		onselect({ selected: sel, input: $value });
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
							$value = cValue;
							oninput(e.currentTarget, cValue);
							changed = true;
						}}
						on:blur={() => {
							if (!allowCustom && !selectedItem && !filtered.length) clear();
							if (!$value) open = false;
						}}
						aria-invalid={($errors || []).length ? "true" : undefined}
						use:builder.action
						{...builder}
					/>
				</Combobox.Input>
			</label>
			{#if (showOnEmpty || $value?.trim()) && filtered.length}
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
		{#if $value && clearable}
			<button class="btn join-item input-bordered" type="button" on:click|preventDefault={() => clear()}>
				<Icon src="x" class="w-6" color="red" />
			</button>
		{/if}
		{#if link}
			<a href={link} class="btn join-item input-bordered" role="button" target="_blank">
				<Icon src="pencil" class="w-6" />
			</a>
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
