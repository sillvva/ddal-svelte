<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { queryParameters, ssp } from "sveltekit-search-params";
	import { twMerge } from "tailwind-merge";

	const s = queryParameters({
		s: ssp.string()
	});

	type Props = Omit<HTMLInputAttributes, "class"> & { class?: string | null };
	let { value = $bindable(s.value || ""), class: className, type = "text", ...rest }: Props = $props();
</script>

<search class="min-w-0 flex-1">
	<input
		{type}
		bind:value
		oninput={(e) => (s.value = e.currentTarget.value || null)}
		class={twMerge("input sm:input-sm focus:border-primary w-full flex-1", className)}
		aria-label={rest.placeholder || "Search"}
		{...rest}
	/>
</search>
