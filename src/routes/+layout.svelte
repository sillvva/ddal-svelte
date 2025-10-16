<script lang="ts">
	import { dev } from "$app/environment";
	import { onNavigate } from "$app/navigation";
	import Head from "$lib/components/head.svelte";
	import * as API from "$lib/remote";
	import { appDefaults } from "$lib/schemas";
	import { createGlobal } from "$lib/stores.svelte";
	import { wait } from "@sillvva/utils";
	import "../app.css";

	let { children } = $props();

	const global = createGlobal(appDefaults);
	const request = await API.app.queries.request();
	global.app = request.app;
	global.user = request.user;
	global.session = request.session;

	onNavigate(async (navigation) => {
		if (!document.startViewTransition) return;
		if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
				await wait(100);
			});
		});
	});
</script>

<Head />

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
