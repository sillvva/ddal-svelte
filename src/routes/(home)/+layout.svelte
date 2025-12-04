<script>
	import Footer from "$lib/components/footer.svelte";
	import { getRequest } from "$lib/stores.svelte";

	let { children } = $props();

	const { app } = $derived(await getRequest());
</script>

<img
	src="/images/barovia-gate.webp"
	alt="Background"
	class="fixed! z-0 min-h-dvh min-w-screen object-cover object-center opacity-25 dark:opacity-20 print:hidden"
/>

<div class="flex min-h-dvh flex-col" data-theme={app.settings.mode}>
	{@render children()}
	<Footer fixed />
</div>
