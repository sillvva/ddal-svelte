<script lang="ts">
	import { dev } from '$app/env';
	import { afterNavigate, onNavigate } from "$app/navigation";
	import * as API from "#lib/remote/index.js";
	import { getGlobal, getLogger } from "#lib/stores.svelte.js";
	import { Toaster } from "svelte-sonner";
	import "../app.css";

	let { children } = $props();

	getLogger();

	const global = getGlobal();
	const request = await API.app.queries.request();
	global.app = request.app;

	// `data-navigating` lets e2e tests wait out client-side navigations: SvelteKit updates the URL before the new page renders.
	onNavigate(({ complete, from, to, shallow }) => {
		document.documentElement.toggleAttribute("data-navigating", true);
		if (shallow) return;
		if (!document.startViewTransition) return;
		if (from?.url.pathname === to?.url.pathname) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await complete;
			});
		});
	});

	afterNavigate(() => {
		document.documentElement.removeAttribute("data-navigating");
	});
</script>

{@render children()}

<Toaster richColors closeButton theme={global.app.settings.mode} />

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
