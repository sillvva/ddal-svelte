<script lang="ts">
	import { hotkey } from "$lib/util";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { queryParameters, ssp } from "sveltekit-search-params";

	const params = queryParameters(
		{
			s: ssp.string()
		},
		{
			showDefaults: false,
			pushHistory: false
		}
	);

	let { value = $bindable(params.s ?? ""), type = "text", ...rest }: Omit<HTMLInputAttributes, "class"> = $props();

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
	<label class="input focus-within:border-primary sm:input-sm flex w-full items-center gap-2" class:pr-0={!!value.trim()}>
		<input
			{type}
			bind:value
			bind:this={ref}
			class="w-full flex-1"
			aria-label={rest.placeholder || "Search"}
			oninput={() => (params.s = value.trim() || null)}
			{...rest}
		/>
		{#if value.trim()}
			<button
				class="btn btn-sm btn-ghost"
				onclick={() => {
					value = "";
					params.s = null;
				}}
				aria-label="Clear Search"
			>
				<span class="iconify mdi--close"></span>
			</button>
		{:else}
			<kbd class="kbd kbd-sm max-sm:hidden">/</kbd>
		{/if}
	</label>
</search>
