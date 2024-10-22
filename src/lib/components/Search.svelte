<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { queryParam, ssp } from "sveltekit-search-params";

	type Props = HTMLInputAttributes;

	let { value = $bindable(""), ...rest }: Props = $props();

	const s = queryParam("s", ssp.string());
	$effect(() => {
		value = $s || "";
		if ($s === "") $s = null;
	});
</script>

<search class="min-w-0 flex-1">
	<input type="text" bind:value={$s} class="input input-bordered w-full flex-1 sm:input-sm" {...rest} />
</search>
