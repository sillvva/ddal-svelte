<script lang="ts">
	import { hotkey } from "$lib/util";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { queryParam, ssp } from "sveltekit-search-params";
	import { twMerge } from "tailwind-merge";

	interface Props extends HTMLInputAttributes {
		class?: string | null;
	}

	const s = queryParam("s", ssp.string(), {
		showDefaults: false,
		pushHistory: false
	});

	let { value = $bindable($s || ""), class: className, type = "text", ...rest }: Props = $props();

	// Sync value prop changes to $s
	$effect(() => {
		$s = value.trim() || null;
	});

	// Sync $s changes to value prop (when URL changes)
	$effect(() => {
		value = $s || "";
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
			bind:value
			class={twMerge("w-full flex-1", className)}
			aria-label={rest.placeholder || "Search"}
			bind:this={ref}
			{...rest}
		/>
		<kbd class="kbd kbd-sm max-sm:hidden">/</kbd>
	</label>
</search>
