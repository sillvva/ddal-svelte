<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { hotkey } from "#lib/util.js";
	import { debounce } from "@sillvva/utils";
	import { onMount } from "svelte";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { SvelteURL } from "svelte/reactivity";

	let {
		name = "s",
		type = "text",
		...rest
	}: Omit<HTMLInputAttributes, "class" | "name" | "value"> & { name?: string } = $props();

	const url = new SvelteURL(page.url.href);
	const value = $derived(url.searchParams.get(name) ?? "");

	const updateValue = debounce((val: string) => {
		updateSearch(val);
	}, 300);

	function updateSearch(val: string, replace: boolean = false) {
		if (replace) {
			goto(url, {
				shallow: true,
				replace: true,
				state: { ...page.state, search: { ...page.state.search, [name]: val } }
			});
		} else {
			goto(url, {
				shallow: true,
				state: { ...page.state, search: { ...page.state.search, [name]: val } }
			});
		}
	}

	onMount(() => {
		if (value) updateSearch(value, true);
	});

	let ref: HTMLInputElement;
</script>

<form
	method="get"
	class="min-w-0 flex-1"
	onsubmit={(e) => {
		e.preventDefault();
		updateValue.cancel();
		updateSearch(ref.value);
	}}
>
	<search
		class="input focus-within:border-primary sm:input-sm flex w-full items-center gap-2 max-sm:*:text-base noscript:pr-0"
		class:pr-0={!!value.trim()}
		{@attach hotkey([
			[
				"/",
				() => {
					ref.focus();
				}
			]
		])}
	>
		<input
			type={type}
			name={name}
			value={value}
			bind:this={ref}
			class="w-full flex-1"
			aria-label={rest.placeholder || "Search"}
			oninput={(e) => {
				const val = (e.target as HTMLInputElement).value;
				if (val) {
					url.searchParams.set(name, val);
					updateValue.call(val);
				} else {
					url.searchParams.delete(name);
					updateValue.call("");
				}
			}}
			{...rest}
		/>
		<span class="noscript:hidden">
			{#if value?.trim()}
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					onclick={() => {
						url.searchParams.delete(name);
						updateSearch("");
					}}
					aria-label="Clear Search"
				>
					<span class="iconify mdi--close"></span>
				</button>
			{:else}
				<kbd class="kbd kbd-sm max-sm:hidden">/</kbd>
			{/if}
		</span>
		<span class="hidden noscript:inline">
			<button type="submit" class="btn btn-sm btn-ghost" aria-label="Search">
				<span class="iconify mdi--magnify"></span>
			</button>
		</span>
	</search>
</form>
