<script lang="ts">
	import { sorter } from "$lib/utils";
	import { createEventDispatcher, onMount } from "svelte";
	import { twMerge } from "tailwind-merge";

	const dispatch = createEventDispatcher<{
		select: string | number;
		input: Event & {
			currentTarget: EventTarget & HTMLInputElement;
		};
		change: Event & {
			currentTarget: EventTarget & HTMLInputElement;
		};
		blur: Event & {
			currentTarget: EventTarget & HTMLInputElement;
		};
		focus: Event & {
			currentTarget: EventTarget & HTMLInputElement;
		};
	}>();

	export let options:
		| {
				values: { key: string; value: string }[];
				value: string;
				searchBy?: "key" | "value";
		  }
		| {
				values: { key: number; value: string }[];
				value: number;
				searchBy?: "key";
		  }
		| {
				values: { key: number; value: string }[];
				value: string;
				searchBy?: "value";
		  }
		| {
				values: { key?: undefined; value: string }[];
				value: string;
				searchBy?: "value";
		  };

	let { values, value, searchBy = "key" in values[0] && typeof value === typeof values[0]?.key ? "key" : "value" } = options;

	let keysel = 0;
	let search = value?.toString() || "";
	let selected = false;

	$: parsedValues = values.map((v) => ({ key: "key" in v ? v.key : "", value: v.value })).filter((v) => v.key !== null);
	$: matches =
		parsedValues && parsedValues.length > 0 && search.trim()
			? parsedValues
					.filter((v) => `${searchBy == "key" ? v.key : v.value}`.toLowerCase().includes(search.toLowerCase()))
					.sort((a, b) => sorter(a.value, b.value))
			: [];

	onMount(() => {
		selected = matches.length === 1;
	});

	const selectHandler = (key: number) => {
		const match = matches[key];
		dispatch("select", match?.key || "");
		keysel = match ? key : 0;
		selected = !!match;
		search = "";
	};

	const selectNew = (value: string) => {
		dispatch("select", value);
		selected = true;
		search = "";
	};
</script>

<div
	class="dropdown"
	role="combobox"
	aria-controls="options-{$$restProps.name}"
	aria-expanded={!!(parsedValues && parsedValues.length > 0 && search.trim() && !selected)}
>
	<label>
		<input
			type="text"
			bind:value
			{...$$restProps}
			on:input={(e) => {
				selected = false;
				keysel = 0;
				search = e.currentTarget.value;
				dispatch("input", e);
			}}
			on:change={(e) => dispatch("change", e)}
			on:focus={(e) => dispatch("focus", e)}
			on:keydown={(e) => {
				if (!parsedValues.length || !search.trim()) return;
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
					if (matches.length) selectHandler(keysel);
					else selectNew(search);
				}
				if (e.code === "Escape") {
					e.preventDefault();
					if (selected) return false;
					selectHandler(-1);
					return false;
				}
			}}
			on:blur={(e) => {
				if (!selected) {
					if (search.trim()) {
						const match = matches.findIndex(
							(v) => v[searchBy || "key"]?.toString().toLowerCase() === e.currentTarget.value.toLowerCase()
						);
						if (match >= 0) selectHandler(match);
						else selectNew(search.trim());
					} else selectNew(search.trim());
				}
				dispatch("blur", e);
			}}
			class="input-bordered input w-full focus:border-primary"
		/>
	</label>
	{#if parsedValues && parsedValues.length > 0 && search.trim() && !selected}
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
