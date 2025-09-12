<script>
	import Footer from "$lib/components/Footer.svelte";
	import { onMount } from "svelte";

	let { children } = $props();

	onMount(() => {
		document.documentElement.dataset.theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
	});
</script>

<img
	src="/images/barovia-gate.webp"
	alt="Background"
	class="fixed! z-0 min-h-dvh min-w-full object-cover object-center opacity-25 dark:opacity-20 print:hidden"
/>

<div class="flex min-h-dvh flex-col">
	{@render children()}
	<Footer fixed />
</div>
