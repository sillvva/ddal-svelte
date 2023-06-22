<script lang="ts">
	import { onMount } from "svelte";
	import { twMerge } from "tailwind-merge";

	export let values: { key?: string | number | null; value: string }[] = [];
	export let value: string | number = "";
	export let onSelect: (value: string | number) => void;
	export let onChange: (
		e: Event & {
			currentTarget: EventTarget & HTMLInputElement;
		}
	) => void = (e) => {};
	export let onBlur: (
		e: FocusEvent & {
			currentTarget: EventTarget & HTMLInputElement;
		}
	) => void = (e) => {};
	export let searchBy: "key" | "value" = "key";

	let keysel = 0;
	let valSearch = value?.toString();
	let selected = false;

	$: parsedValues = values.map((v) => ({ key: v.key ?? v.value, value: v.value })).filter((v) => v.key !== null);
	$: matches =
		parsedValues && parsedValues.length > 0 && valSearch.trim()
			? parsedValues
					.filter((v) => `${searchBy == "key" ? v.key : v.value}`.toLowerCase().includes(valSearch.toLowerCase()))
					.sort((a, b) => (a.value > b.value ? 1 : -1))
			: [];

	onMount(() => {
		selected = matches.length === 1;
	});

	const selectHandler = (key: number) => {
		const match = matches[key];
		onSelect(match?.key || "");
		keysel = match ? key : 0;
		selected = !!match;
		valSearch = "";
	};
</script>

<div
	class="dropdown"
	role="combobox"
	aria-controls="options-{$$restProps.name}"
	aria-expanded={!!(parsedValues && parsedValues.length > 0 && valSearch.trim() && !selected)}
>
	<label>
		<input
			type="text"
			bind:value
			{...$$restProps}
			on:input={(e) => {
				selected = false;
				keysel = 0;
				valSearch = e.currentTarget.value;
				if (onChange) onChange(e);
			}}
			on:keydown={(e) => {
				if (!parsedValues.length || !valSearch.trim()) return;
				if (e.code === "ArrowDown") {
					e.preventDefault();
					if (selected) return false;
					keysel = keysel + 1;
					if (keysel >= matches.length) keysel = 0;
					return false;
				}
				if (e.code === "ArrowUp") {
					e.preventDefault();
					if (selected) return false;
					keysel = keysel - 1;
					if (keysel < 0) keysel = matches.length - 1;
					return false;
				}
				if (e.code === "Enter" || e.code === "Tab") {
					e.preventDefault();
					if (selected) return false;
					selectHandler(keysel);
					return false;
				}
				if (e.code === "Escape") {
					e.preventDefault();
					if (selected) return false;
					selectHandler(-1);
					return false;
				}
			}}
			on:blur={(e) => {
				if (!selected && valSearch.trim())
					selectHandler(matches.findIndex((v) => v[searchBy].toString().toLowerCase() === e.currentTarget.value.toLowerCase()));
				if (onBlur) onBlur(e);
			}}
			class="input-bordered input w-full focus:border-primary"
		/>
	</label>
	{#if parsedValues && parsedValues.length > 0 && valSearch.trim() && !selected}
		<ul id="options-{$$restProps.name}" class="dropdown-content menu w-full rounded-lg bg-base-100 p-2 shadow dark:bg-base-200">
			{#each matches.slice(0, 8) as kv, i}
				<li class={twMerge("hover:bg-primary/50", keysel === i && "bg-primary text-primary-content")}>
					<span
						class="rounded-none px-4 py-2"
						role="option"
						tabindex="0"
						aria-selected={keysel === i}
						on:mousedown={() => selectHandler(i)}
					>
						{kv.value}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>
