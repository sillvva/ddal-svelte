<script>
	import Footer from "$lib/components/Footer.svelte";
	import * as API from "$lib/remote";

	let { children } = $props();

	const request = $derived(await API.app.queries.request());
</script>

<img
	src="/images/barovia-gate.webp"
	alt="Background"
	class="fixed! z-0 min-h-dvh min-w-screen object-cover object-center opacity-25 dark:opacity-20 print:hidden"
/>

<div class="flex min-h-dvh flex-col" data-theme={request.app.settings.mode}>
	{@render children()}
	<Footer fixed />
</div>
