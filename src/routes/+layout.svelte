<script lang="ts">
	import { dev } from "$app/environment";
	import { createGlobal, setTransition } from "$lib/stores.svelte";
	import { setCookie } from "$server/cookie";
	import "../app.css";

	let { data, children } = $props();

	const global = createGlobal(data.app);
	$effect(() => {
		setCookie("app", global.app);
	});

	setTransition();
</script>

<div class="no-script-hide bg-base-100 text-base-content min-h-dvh">
	{@render children()}
</div>

<noscript>
	<style>
		.no-script-hide {
			display: none;
		}
	</style>
	<div class="flex min-h-dvh items-center justify-center text-2xl">This site requires JavaScript to function properly.</div>
</noscript>

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
