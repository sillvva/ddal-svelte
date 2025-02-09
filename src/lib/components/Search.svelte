<script lang="ts">
	import { hotkey } from "@svelteuidev/composables";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { queryParameters, ssp } from "sveltekit-search-params";
	import { twMerge } from "tailwind-merge";

	const s = queryParameters({
		s: ssp.string()
	});

	type Props = Omit<HTMLInputAttributes, "class"> & { class?: string | null };
	let { value = $bindable(s.value || ""), class: className, type = "text", ...rest }: Props = $props();

	let ref: HTMLInputElement | undefined = undefined;
</script>

<search
	class="min-w-0 flex-1"
	use:hotkey={[
		[
			"/",
			() => {
				ref?.focus();
			}
		]
	]}
>
	<label class="input focus-within:border-primary sm:input-sm flex w-full items-center gap-2">
		<input
			{type}
			bind:value
			oninput={(e) => (s.value = e.currentTarget.value || null)}
			class={twMerge("w-full flex-1", className)}
			aria-label={rest.placeholder || "Search"}
			bind:this={ref}
			{...rest}
		/>
		<kbd class="kbd kbd-sm max-sm:hidden">/</kbd>
	</label>
</search>
