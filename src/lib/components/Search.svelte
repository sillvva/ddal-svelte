<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { hotkey } from "$lib/util";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { twMerge } from "tailwind-merge";

	interface Props extends HTMLInputAttributes {
		class?: string | null;
	}

	let { value = $bindable(page.url.searchParams.get("s") || ""), class: className, type = "text", ...rest }: Props = $props();

	$effect(() => {
		value = page.url.searchParams.get("s") || "";
	});

	let ref: HTMLInputElement | undefined = undefined;
</script>

<svelte:document
	{@attach hotkey([
		[
			"/",
			() => {
				ref?.focus();
			}
		]
	])}
/>

<search class="min-w-0 flex-1">
	<label class="input focus-within:border-primary sm:input-sm flex w-full items-center gap-2">
		<input
			{type}
			{value}
			oninput={(e) => {
				if (e.currentTarget.value.trim()) {
					page.url.searchParams.set("s", e.currentTarget.value);
				} else {
					page.url.searchParams.delete("s");
				}
				const params = page.url.searchParams.size ? "?" + page.url.searchParams.toString() : "";
				goto(page.url.pathname + params, {
					replaceState: true,
					keepFocus: true,
					noScroll: true
				});
			}}
			class={twMerge("w-full flex-1", className)}
			aria-label={rest.placeholder || "Search"}
			bind:this={ref}
			{...rest}
		/>
		<kbd class="kbd kbd-sm max-sm:hidden">/</kbd>
	</label>
</search>
