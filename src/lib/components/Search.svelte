<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { queryParam } from "sveltekit-search-params";
	import { twMerge } from "tailwind-merge";

	const s = queryParam("s");

	type Props = HTMLInputAttributes;
	let { value = $bindable($s || ""), class: className, type = "text", ...rest }: Props = $props();
</script>

<search class="min-w-0 flex-1">
	<input
		{type}
		bind:value
		oninput={(e) => ($s = e.currentTarget.value || null)}
		class={twMerge("input input-bordered w-full flex-1 sm:input-sm", className)}
		{...rest}
	/>
</search>
