<script lang="ts">
	import { afterNavigate, beforeNavigate, goto } from "$app/navigation";
	import { page } from "$app/state";
	import { hotkey } from "$lib/util";
	import { debounce } from "@sillvva/utils";
	import { tick } from "svelte";
	import type { HTMLInputAttributes } from "svelte/elements";

	let {
		name = "s",
		type = "text",
		...rest
	}: Omit<HTMLInputAttributes, "class" | "name" | "value"> & { name?: string } = $props();

	const value = $derived(page.url.searchParams.get(name) ?? "");

	const updateValue = debounce(() => {
		formRef.requestSubmit();
	}, 300);

	beforeNavigate(() => {
		if (ref && ref.contains(document.activeElement)) {
			localStorage.setItem("hasFocus", "true");
			const pos = ref.selectionStart ?? 0;
			localStorage.setItem("position", String(pos));
		}
	});

	afterNavigate(async () => {
		await tick();
		if (localStorage.getItem("hasFocus") === "true") {
			const savedPosition = Number.parseInt(localStorage.getItem("position") ?? "0", 10);
			localStorage.removeItem("hasFocus");
			localStorage.removeItem("position");
			if (ref) {
				ref.focus();
				await tick();
				if (document.activeElement === ref) {
					ref.setSelectionRange(savedPosition, savedPosition);
				}
			}
		}
	});

	let formRef: HTMLFormElement;
	let ref: HTMLInputElement;
</script>

<form bind:this={formRef} method="get" class="min-w-0 flex-1">
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
			{type}
			{name}
			{value}
			bind:this={ref}
			class="w-full flex-1"
			aria-label={rest.placeholder || "Search"}
			oninput={(e) => {
				const val = e.currentTarget.value;
				if (val) updateValue.call();
				else {
					const url = new URL(page.url);
					url.searchParams.delete(name);
					goto(url.pathname + url.search);
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
						const url = new URL(page.url);
						url.searchParams.delete(name);
						goto(url.pathname + url.search);
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
