<script lang="ts">
	import { createEventDispatcher, onMount } from "svelte";
	import { twMerge } from "tailwind-merge";

	const dispatch = createEventDispatcher<{ select: string | number }>();

	export let values: { key?: string | number | null; value: string }[] = [];
	export let value: string | number | null = "";
	export let searchBy: "key" | "value" = "key";

	let keysel = 0;
	let search = value?.toString() || "";
	let selected = false;

	$: parsedValues = values.map((v) => ({ key: v.key ?? v.value, value: v.value })).filter((v) => v.key !== null);
	$: matches =
		parsedValues && parsedValues.length > 0 && search.trim()
			? parsedValues
					.filter((v) => `${searchBy == "key" ? v.key : v.value}`.toLowerCase().includes(search.toLowerCase()))
					.sort((a, b) => (a.value > b.value ? 1 : -1))
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
			}}
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
				if (!selected && search.trim()) {
					if (matches.length)
						selectHandler(matches.findIndex((v) => v[searchBy].toString().toLowerCase() === e.currentTarget.value.toLowerCase()));
					else {
						selectNew(search);
					}
				}
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
