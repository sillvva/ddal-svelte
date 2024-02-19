<script lang="ts">
	import { dev } from "$app/environment";
	import { createEventDispatcher } from "svelte";
	import SuperDebug from "sveltekit-superforms";
	import Icon from "./Icon.svelte";
	import { Combobox } from "bits-ui";
	import { twMerge } from "tailwind-merge";

	export let id = "";
	export let values: Array<{ value: string; label?: string }> = [];
	export let value = "";
	export let allowCustom = false;
	export let showOnEmpty = false;
	export let clearable = false;
	export let disabled = false;
	export let required = false;
	export let errors: string[] = [];

	let inputValue = "";
	let debug = false;

	$: selectedItem = value ? values.find((v) => v.value === value) : undefined;

	const dispatch = createEventDispatcher<{
		input: void;
		select: (typeof values)[number] | undefined;
		clear: void;
	}>();

	$: withLabel = values.map(({ value, label }) => ({ value, label: label || value }));
	$: withCustom =
		!inputValue?.trim() || !allowCustom ? withLabel : [{ value: inputValue, label: `Add "${inputValue}"` }, ...withLabel];
	$: filtered = withCustom.filter(({ label }) =>
		label
			.toLowerCase()
			.replace(/\s+/g, "")
			.includes((inputValue || "").toLowerCase().replace(/\s+/g, ""))
	);
</script>

<div class="join">
	<div class="dropdown w-full">
		<Combobox.Root
			items={withCustom}
			bind:inputValue
			bind:selected={selectedItem}
			{disabled}
			{required}
			onSelectedChange={(sel) => {
				dispatch("select", sel);
			}}
		>
			<Combobox.Input
				{id}
				class="input join-item input-bordered w-full focus:border-primary"
				on:input={() => {
					dispatch("input");
					if (selectedItem && selectedItem.label !== inputValue) {
						selectedItem = undefined;
					}
				}}
				aria-invalid={errors ? "true" : undefined}
			/>
		</Combobox.Root>
		{#if (showOnEmpty || inputValue?.trim()) && filtered.length}
			<Combobox.Content class="menu dropdown-content z-10 w-full rounded-lg bg-base-200 p-2 shadow">
				{#each filtered.slice(0, 8) as item}
					<Combobox.Item
						class={twMerge(
							"hover:bg-primary/50",
							"data-[highlighted]:bg-primary data-[highlighted]:text-primary-content",
							"data-[selected]:bg-primary data-[selected]:font-bold data-[selected]:text-primary-content"
						)}
						value={item.value}
						label={item.label}
					>
						<span class="rounded-none px-4 py-2">
							{item.label}
						</span>
					</Combobox.Item>
				{:else}
					<span class="block px-5 py-2 text-sm"> No results found </span>
				{/each}
			</Combobox.Content>
		{/if}
	</div>
	{#if inputValue && selectedItem && clearable}
		<button
			class="btn join-item input-bordered"
			type="button"
			on:click|preventDefault={() => {
				selectedItem = undefined;
				// inputValue = "";
				// value = "";
				dispatch("clear");
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
