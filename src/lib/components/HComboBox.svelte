<script lang="ts">
	import { dev } from "$app/environment";
	import { createEventDispatcher } from "svelte";
	import { createCombobox } from "svelte-headlessui";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { fade } from "svelte/transition";
	import SuperDebug from "sveltekit-superforms";
	import { twMerge } from "tailwind-merge";
	import Icon from "./Icon.svelte";

	interface $$Props extends HTMLInputAttributes {
		values: typeof values;
		value: typeof value;
		allowCustom?: typeof allowCustom;
		showOnEmpty?: typeof showOnEmpty;
		clearable?: typeof clearable;
		selected?: typeof selected;
	}

	export let values: Array<{ key?: string; value: string; label?: string }> = [];
	export let value: string | null = "";
	export let allowCustom: boolean = false;
	export let showOnEmpty: boolean = false;
	export let clearable: boolean = false;
	export let selected: boolean = false;

	let debug = false;

	const dispatch = createEventDispatcher<{
		input: void;
		select: (typeof values)[number] | null;
		clear: void;
	}>();

	const combobox = createCombobox();

	$: if (!selected) {
		$combobox.selected = null;
		$combobox.active = 0;
	}

	$: withLabel = values.map((v) => ({ ...v, label: v.label || v.value }));
	$: matched =
		withLabel.filter((v) =>
			v.label
				.toLowerCase()
				.replace(/\s+/g, "")
				.includes((value || "").toLowerCase().replace(/\s+/g, ""))
		).length === 1;
	$: withCustom = matched || !value?.trim() || !allowCustom ? withLabel : [{ value, label: `Add "${value}"` }, ...withLabel];
	$: filtered = withCustom.filter((v) =>
		v.label
			.toLowerCase()
			.replace(/\s+/g, "")
			.includes((value || "").toLowerCase().replace(/\s+/g, ""))
	);
</script>

<div class="join">
	<div class="dropdown w-full">
		<label>
			<input
				{...$$restProps}
				bind:value
				use:combobox.input
				class="input join-item input-bordered w-full focus:border-primary"
				on:input={() => dispatch("input")}
				on:select={() => {
					value = $combobox.selected.value;
					selected = true;
					dispatch("select", $combobox.selected);
				}}
				on:change={() => {
					if ($combobox.selected && $combobox.selected.value !== value) {
						selected = false;
					}
					setTimeout(() => {
						if (!allowCustom && !$combobox.selected) value = "";
						dispatch("select", $combobox.selected);
					}, 10);
				}}
			/>
		</label>
		{#if $combobox.expanded && (showOnEmpty || value?.trim()) && (filtered.length || allowCustom)}
			<ul
				use:combobox.items
				class="menu dropdown-content z-10 w-full rounded-lg bg-base-200 p-2 shadow"
				transition:fade={{ duration: 150 }}
			>
				{#each filtered.slice(0, 8) as value}
					{@const active = $combobox.active === value}
					{@const selected = $combobox.selected === value}
					<li
						class={twMerge(
							"hover:bg-primary/50",
							(active || selected) && "bg-primary text-primary-content",
							selected && "font-bold"
						)}
						use:combobox.item={{ value }}
					>
						<span class="rounded-none px-4 py-2">
							{value.label}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
	{#if value && selected && clearable}
		<button
			class="btn join-item input-bordered"
			type="button"
			on:click|preventDefault={() => {
				dispatch("clear");
				selected = false;
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
	<SuperDebug data={$combobox} />
{/if}
