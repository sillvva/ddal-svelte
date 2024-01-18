<script lang="ts">
	import { dev } from "$app/environment";
	import { cookieStore } from "$src/server/cookie";
	import { setContext } from "svelte";
	import { setupViewTransition } from "sveltekit-view-transition";
	import { twMerge } from "tailwind-merge";
	import "../app.css";

	export let data;

	const app = setContext("app", cookieStore("app", data.app));

	const { transition } = setupViewTransition();
	setContext("transition", transition);
</script>

{#if !data.mobile && $app.settings.background}
	<img
		src="/images/barovia-gate.webp"
		alt="Background"
		class="no-script-hide !fixed z-0 min-h-dvh min-w-full object-cover object-center opacity-25 dark:opacity-20 print:hidden"
	/>
{/if}

<div
	class={twMerge(
		"min-h-dvh text-base-content",
		(data.mobile || !$app.settings.background) && "bg-base-200 dark:[--b1:27.35%_0.018_251.92]"
	)}
>
	<slot />
</div>

<noscript>
	<style>
		.no-script-hide {
			display: none;
		}
	</style>
	<div class="fixed bottom-0 left-0 right-0 z-50 flex justify-center bg-red-800 p-2 text-center font-bold">
		Without JavaScript enabled, several features of the app will be disabled.<br />Your experience will be downgraded.
	</div>
</noscript>

{#if dev}
	<div class="fixed bottom-0 right-0 z-50">
		<div class="*:bg-lime-700 *:p-1 *:text-xs *:font-bold *:text-white">
			<div class="xs:hidden">xxs</div>
			<div class="hidden xs:block sm:hidden">xs</div>
			<div class="hidden sm:block md:hidden">sm</div>
			<div class="hidden md:block lg:hidden">md</div>
			<div class="hidden lg:block xl:hidden">lg</div>
			<div class="hidden xl:block 2xl:hidden">xl</div>
			<div class="hidden 2xl:block">2xl</div>
		</div>
	</div>
{/if}
