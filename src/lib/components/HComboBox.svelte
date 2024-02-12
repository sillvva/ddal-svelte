<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { createCombobox } from "svelte-headlessui";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { fade } from "svelte/transition";
	import { twMerge } from "tailwind-merge";

	export let values: Array<{ key?: string; value: string; label: string }> = [];
	export let value: string | null = "";
	export let canCreate: boolean = false;
	export let showOnEmpty: boolean = false;

	const dispatch = createEventDispatcher<{
		select: (typeof values)[number];
		input?: null;
	}>();

	interface $$Props extends HTMLInputAttributes {
		values: typeof values;
		value: typeof value;
		canCreate?: typeof canCreate;
		showOnEmpty?: typeof showOnEmpty;
	}

	const combobox = createCombobox();

	$: sorted = values.sort((a, b) => a.label.localeCompare(b.label));
	$: matched =
		sorted.filter((v) =>
			v.label
				.toLowerCase()
				.replace(/\s+/g, "")
				.includes((value || "").toLowerCase().replace(/\s+/g, ""))
		).length === 1;
	$: withCustom = matched || !value?.trim() ? sorted : [{ value, label: `Create "${value}"` }, ...sorted];
	$: filtered = withCustom.filter((v) =>
		v.label
			.toLowerCase()
			.replace(/\s+/g, "")
			.includes((value || "").toLowerCase().replace(/\s+/g, ""))
	);

	$: if ($combobox.selected && $combobox.selected.value !== value) {
		$combobox.selected = null;
	}
</script>

<div class="dropdown" role="combobox" aria-controls="options-{$$restProps.name}" aria-expanded={$combobox.expanded}>
	<label>
		<input
			{...$$restProps}
			type="text"
			bind:value
			use:combobox.input
			on:select={() => {
				value = $combobox.selected.value;
				dispatch("select", $combobox.selected);
			}}
			on:blur={() => {
				setTimeout(() => {
					dispatch("select", $combobox.selected || { value, label: value });
				}, 100);
			}}
			on:input={() => {
				dispatch("input", null);
			}}
			class="input input-bordered w-full focus:border-primary"
		/>
	</label>
	{#if $combobox.expanded && (showOnEmpty || value?.trim()) && (filtered.length || canCreate)}
		<ul
			use:combobox.items
			id="options-{$$restProps.name}"
			class="menu dropdown-content z-10 w-full rounded-lg bg-base-100 p-2 shadow dark:bg-base-200"
			transition:fade={{ duration: 150 }}
		>
			{#each filtered.slice(0, 8) as value}
				{@const active = $combobox.active === value}
				{@const selected = $combobox.selected === value}
				<li
					role="option"
					aria-selected="false"
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
