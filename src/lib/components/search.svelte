<script lang="ts">
	import { hotkey } from "#lib/attachments.js";
	import { getPageSearchValue } from "#lib/search.js";
	import { afterNavigate, goto } from "$app/navigation";
	import { page } from "$app/state";
	import { debounce } from "@sillvva/utils";
	import { onMount } from "svelte";
	import type { HTMLInputAttributes } from "svelte/elements";

	let {
		name = "s",
		type = "text",
		...rest
	}: Omit<HTMLInputAttributes, "class" | "name" | "value"> & { name?: string } = $props();

	const searchValue = $derived(getPageSearchValue(page, name));
	let draft = $state<string | null>(null);
	const value = $derived(draft ?? searchValue);
	let ref: HTMLInputElement;
	let internalNav = 0;

	const updateValue = debounce((val: string) => {
		void updateSearch(val);
	}, 300);

	async function updateSearch(val: string, replace: boolean = false) {
		const nextUrl = new URL((page.shallow?.url ?? page.url).href);
		if (val) nextUrl.searchParams.set(name, val);
		else nextUrl.searchParams.delete(name);

		internalNav += 1;
		try {
			await goto(nextUrl, {
				shallow: true,
				replace,
				state: { ...page.state, search: { ...page.state.search, [name]: val } }
			});
		} finally {
			internalNav -= 1;
			if (draft === val) draft = null;
		}
	}

	afterNavigate(() => {
		if (internalNav === 0) {
			updateValue.cancel();
			draft = null;
		}
	});

	onMount(() => {
		if (searchValue && page.state.search?.[name] === undefined) {
			void updateSearch(searchValue, true);
		}
		return () => {
			updateValue.cancel();
		};
	});
</script>

<form
	method="get"
	class="min-w-0 flex-1"
	onsubmit={(e) => {
		e.preventDefault();
		updateValue.cancel();
		const val = ref.value;
		draft = val;
		void updateSearch(val);
	}}
>
	<search
		class={[
			"input flex w-full items-center gap-2 focus-within:border-primary max-sm:*:text-base sm:input-sm noscript:pr-0",
			!!value.trim() && "pr-0"
		]}
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
			{type}
			{name}
			{value}
			bind:this={ref}
			class="w-full flex-1"
			aria-label={rest.placeholder || "Search"}
			oninput={(e) => {
				const val = e.currentTarget.value;
				draft = val;
				updateValue.call(val);
			}}
			{...rest}
		/>
		<span class="noscript:hidden">
			{#if value.trim()}
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={() => {
						updateValue.cancel();
						draft = "";
						void updateSearch("");
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
			<button type="submit" class="btn btn-ghost btn-sm" aria-label="Search">
				<span class="iconify mdi--magnify"></span>
			</button>
		</span>
	</search>
</form>
