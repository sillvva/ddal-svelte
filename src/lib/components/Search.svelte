<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { queryParam, ssp } from "sveltekit-search-params";

	interface $$Props extends HTMLInputAttributes {}

	export let value = "";

	const s = queryParam("s", ssp.string());
	$: value = $s || "";
</script>

<search class="min-w-0 flex-1">
	<input type="text" bind:value={$s} class="no-script-hide input input-bordered w-full flex-1 sm:input-sm" {...$$restProps} />
</search>
