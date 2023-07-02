<script lang="ts">
	import { navigating } from "$app/stores";
	import { pageLoader } from "$src/lib/store";
	import "../app.css";

	let loading = false;
	let timeout: number;
	$: if ($navigating) {
		timeout = setTimeout(() => {
			loading = true;
		}, 200);
	} else {
		loading = false;
		clearTimeout(timeout);
	}
</script>

<svelte:body class="min-h-screen text-base-content" />

<img
	src="/images/barovia-gate.webp"
	alt="Background"
	class="!fixed z-0 min-h-screen min-w-full object-cover object-center opacity-40 dark:opacity-20 print:hidden"
/>

<slot />

{#if $pageLoader || loading}
	<div class="fixed inset-0 z-40 flex items-center justify-center bg-black/50" />
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<span class="loading loading-spinner w-16 text-secondary" />
	</div>
{/if}
