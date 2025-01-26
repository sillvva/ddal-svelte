<script>
	let { children } = $props();
</script>

<img
	src="/images/barovia-gate.webp"
	alt="Background"
	class="fixed! z-0 min-h-dvh min-w-full object-cover object-center opacity-25 dark:opacity-20 print:hidden"
/>

{@render children()}
