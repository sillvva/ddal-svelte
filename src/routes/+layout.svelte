<script lang="ts">
	import { dev } from "$app/environment";
	import { page } from "$app/state";
	import { defaultDescription, defaultImage, defaultTitle } from "$lib/constants";
	import { createGlobal, setTransition } from "$lib/stores.svelte";
	import { Toaster } from "svelte-sonner";
	import "../app.css";

	let { data, children } = $props();

	createGlobal(data.app);
	setTransition();

	const title = $derived(page.data.character ? `${page.data.character.name} - ${defaultTitle}` : defaultTitle);
	const description = $derived(
		page.data.character
			? `Level ${page.data.character.totalLevel} ${page.data.character.race} ${page.data.character.class}`
			: defaultDescription
	);
	const image = $derived(
		page.data.character ? `${page.url.origin}/characters/${page.data.character.id}/og-image.png` : defaultImage
	);
</script>

<svelte:head>
	<title>{title.trim()}</title>
	<meta name="title" content={title.trim()} />
	<meta name="description" content={description.trim()} />
	<meta property="og:title" content={title.trim()} />
	<meta property="og:site_name" content="Adventurers League Log Sheet" />
	<meta property="og:description" content={description.trim()} />
	<meta property="og:image" content={image.trim()} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="en_US" />
	<meta property="og:url" content={page.url.toString()} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title.trim()} />
	<meta name="twitter:description" content={description.trim()} />
	<meta name="twitter:image" content={image.trim()} />
	<meta name="twitter:url" content={page.url.toString()} />
	<link rel="canonical" href={page.url.toString()} />
</svelte:head>

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
