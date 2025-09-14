<script>
	import Footer from "$lib/components/Footer.svelte";
	import LoadingPanel from "$lib/components/LoadingPanel.svelte";
	import AppAPI from "$lib/remote/app";

	let { children } = $props();
</script>

<img
	src="/images/barovia-gate.webp"
	alt="Background"
	class="fixed! z-0 min-h-dvh min-w-screen object-cover object-center opacity-25 dark:opacity-20 print:hidden"
/>

<svelte:boundary>
	{#snippet pending()}
		<div class="flex min-h-dvh flex-col items-center justify-center">
			<LoadingPanel />
		</div>
	{/snippet}

	{@const request = await AppAPI.queries.request()}
	<div class="flex min-h-dvh flex-col" data-theme={request.app.settings.mode}>
		{@render children()}
		<Footer fixed />
	</div>
</svelte:boundary>
