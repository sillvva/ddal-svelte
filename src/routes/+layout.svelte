<script>
	import { pageLoader } from "$src/lib/store";
	import "../app.css";
</script>

<svelte:body class="min-h-screen text-base-content" />

<img
	src="/images/barovia-gate.jpg"
	alt="Background"
	class="!fixed z-0 min-h-screen min-w-full object-cover object-center opacity-40 dark:opacity-20 print:hidden"
/>

<slot />

{#if $pageLoader}
	<div class="fixed inset-0 z-40 flex items-center justify-center bg-black/50" />
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<span class="loading loading-spinner w-16 text-secondary" />
	</div>
{/if}
