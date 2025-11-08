<script lang="ts">
	import { dev } from "$app/environment";
	import { onNavigate } from "$app/navigation";
	import * as API from "$lib/remote";
	import { getGlobal } from "$lib/stores.svelte";
	import "../app.css";

	let { children } = $props();

	const global = getGlobal();
	const request = await API.app.queries.request();
	global.app = request.app;

	onNavigate(({ complete, from, to }) => {
		if (!document.startViewTransition) return;
		if (from?.url.pathname === to?.url.pathname) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await complete;
			});
		});
	});
</script>

{@render children()}

{#if dev}
	<div class="fixed right-0 bottom-0 z-50">
		<div class="*:bg-lime-700 *:p-1 *:text-xs *:font-bold *:text-white">
			<div class="xs:hidden">xxs</div>
			<div class="xs:max-sm:block hidden">xs</div>
			<div class="hidden sm:max-md:block">sm</div>
			<div class="hidden md:max-lg:block">md</div>
			<div class="hidden lg:max-xl:block">lg</div>
			<div class="hidden xl:block">xl</div>
		</div>
	</div>
{/if}
