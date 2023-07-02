<script lang="ts">
	import { navigating } from "$app/stores";
	import { pageLoader } from "$src/lib/store";
	import { fade } from "svelte/transition";
	import "../app.css";
</script>

<svelte:body class="min-h-screen text-base-content" />

<img
	src="/images/barovia-gate.webp"
	alt="Background"
	class="!fixed z-0 min-h-screen min-w-full object-cover object-center opacity-40 dark:opacity-20 print:hidden"
/>

<slot />

{#if $pageLoader || $navigating}
	<div class="fixed inset-0 z-40 flex items-center justify-center bg-black/50" in:fade out:fade={{ duration: 200 }} />
	<div
		class="fixed inset-0 z-50 flex items-center justify-center"
		in:fade={{ duration: 200, delay: 200 }}
		out:fade={{ duration: 200 }}
	>
		<span class="loading loading-spinner w-16 text-secondary" />
	</div>
{/if}
