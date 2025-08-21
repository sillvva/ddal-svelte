<script lang="ts">
	import { hotkey } from "$lib/util";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { queryParameters, ssp } from "sveltekit-search-params";
	import { twMerge } from "tailwind-merge";

	interface Props extends HTMLInputAttributes {
		class?: string | null;
	}

	const params = queryParameters(
		{
			s: ssp.string()
		},
		{
			showDefaults: false,
			pushHistory: false
		}
	);

	let { value = $bindable($params.s || ""), class: className, type = "text", ...rest }: Props = $props();

	// Sync value prop changes to $params.s
	$effect(() => {
		if (value.trim()) {
			$params.s = value;
		} else {
			$params.s = null;
		}
	});

	// Sync $params.s changes to value prop (when URL changes)
	$effect(() => {
		value = $params.s || "";
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
