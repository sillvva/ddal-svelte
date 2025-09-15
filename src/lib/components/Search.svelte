<script lang="ts">
	import { hotkey } from "$lib/util";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { queryParam, ssp } from "sveltekit-search-params";

	const s = queryParam("s", ssp.string(), {
		showDefaults: false,
		pushHistory: false
	});

	let { value = $bindable($s || ""), type = "text", ...rest }: Omit<HTMLInputAttributes, "class"> = $props();

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

<search
	class="min-w-0 flex-1"
	{@attach hotkey([
		[
			"/",
			() => {
				ref?.focus();
			}
		]
	])}
>
	<label class="input focus-within:border-primary sm:input-sm flex w-full items-center gap-2">
		<input {type} bind:value class="w-full flex-1" aria-label={rest.placeholder || "Search"} bind:this={ref} {...rest} />
		<kbd class="kbd kbd-sm max-sm:hidden">/</kbd>
	</label>
</search>
