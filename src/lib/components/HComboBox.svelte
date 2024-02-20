<script lang="ts">
	import { dev } from "$app/environment";
	import { Combobox } from "bits-ui";
	import { createEventDispatcher } from "svelte";
	import SuperDebug from "sveltekit-superforms";
	import { twMerge } from "tailwind-merge";
	import Icon from "./Icon.svelte";

	export let id = "";
	export let values: Array<{ value: string; label?: string; itemLabel?: string }> = [];
	export let value = "";
	export let inputValue = "";
	export let allowCustom = false;
	export let showOnEmpty = false;
	export let clearable = false;
	export let disabled = false;
	export let required = false;
	export let errors: string[] | undefined = [];

	let debug = false;
	let open = false;

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
			.includes((inputValue || "").toLowerCase().replace(/\s+/g, ""))
	);
	$: filtered =
		!inputValue?.trim() || !allowCustom || prefiltered.length === 1
			? prefiltered
			: [{ value: inputValue, label: inputValue, itemLabel: `Add "${inputValue}"` }, ...prefiltered.slice(0, -1)];
	$: if (!value) inputValue = "";
	$: selectedItem = value
		? values.find((v) => v.value === value)
		: inputValue.trim() && allowCustom
			? { value: "", label: inputValue, itemLabel: `Add "${inputValue}"` }
			: undefined;
</script>

<div class="join">
	<div class="dropdown w-full">
		<Combobox.Root
			items={filtered}
			bind:inputValue
			bind:open
			{disabled}
			{required}
			onSelectedChange={(sel) => {
				dispatch("select", { selected: sel, input: inputValue });
			}}
			onOpenChange={() => {
				setTimeout(() => {
					dispatch("select", { selected: selectedItem, input: inputValue });
				}, 10);
			}}
		>
			<label>
				<Combobox.Input asChild let:builder {id}>
					<input
						bind:value={inputValue}
						class="input join-item input-bordered w-full rounded-r-none focus:border-primary"
						on:input={() => {
							dispatch("input");
							if (selectedItem && selectedItem.label !== inputValue) {
								selectedItem = undefined;
							}
						}}
						aria-invalid={(errors || []).length ? "true" : undefined}
						use:builder.action
						{...builder}
					/>
				</Combobox.Input>
			</label>
			{#if (showOnEmpty || inputValue?.trim()) && filtered.length}
				<Combobox.Content class="menu dropdown-content z-10 w-full rounded-lg bg-base-200 p-2 shadow">
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
								data-selected={selectedItem?.value === item.value ? "true" : undefined}
							>
								<span class="rounded-none px-4 py-2">
									{item.itemLabel}
								</span>
							</li>
						</Combobox.Item>
					{:else}
						<span class="block px-5 py-2 text-sm"> No results found </span>
					{/each}
				</Combobox.Content>
			{/if}
		</Combobox.Root>
	</div>
	{#if inputValue && selectedItem && clearable}
		<button
			class="btn join-item input-bordered"
			type="button"
			on:click|preventDefault={() => {
				dispatch("clear");
				selectedItem = undefined;
				inputValue = "";
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

{#if debug}
	<SuperDebug data={selectedItem} />
{/if}
