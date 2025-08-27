<script lang="ts">
	import { dev } from "$app/environment";
	import Head from "$lib/components/Head.svelte";
	import { createGlobal } from "$lib/stores.svelte";
	import { Toaster } from "svelte-sonner";
	import { setupViewTransition } from "sveltekit-view-transition";
	import "../app.css";

	let { data, children } = $props();

	createGlobal(data.app);
	setupViewTransition();
</script>

<Head />

<div class="bg-base-100 text-base-content min-h-dvh noscript:hidden">
	{@render children()}
</div>

<Toaster richColors closeButton theme={data.app.settings.mode} />

<div class="flex min-h-dvh items-center justify-center text-2xl not-noscript:hidden">
	This site requires JavaScript to function properly.
</div>

{#if dev}
	<div class="fixed right-0 bottom-0 z-50">
		<div class="*:bg-lime-700 *:p-1 *:text-xs *:font-bold *:text-white">
			<div class="xs:hidden">xxs</div>
			<div class="xs:max-sm:block hidden">xs</div>
			<div class="hidden sm:max-md:block">sm</div>
			<div class="hidden md:max-lg:block">md</div>
			<div class="hidden lg:max-xl:block">lg</div>
			<div class="hidden xl:max-2xl:block">xl</div>
			<div class="hidden 2xl:block">2xl</div>
		</div>
	</div>
{/if}
