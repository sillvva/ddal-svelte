<script lang="ts">
	import { page } from "$app/state";
	import { SearchParamState } from "$lib/factories.svelte";
	import { hotkey } from "$lib/util";
	import type { HTMLInputAttributes } from "svelte/elements";
	import * as v from "valibot";

	const s = new SearchParamState({
		key: "s",
		schema: v.nullable(v.string()),
		defaultValue: page.url.searchParams.get("s"),
		showDefault: false
	});

	let { value = $bindable(s.state), type = "text", ...rest }: Omit<HTMLInputAttributes, "class"> = $props();

	// Sync value prop changes to s.state
	$effect(() => {
		s.update(value.trim() || null);
	});

	// Sync s.state changes to value prop (when URL changes)
	$effect(() => {
		value = s.state || "";
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
