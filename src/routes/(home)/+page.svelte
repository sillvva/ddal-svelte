<script lang="ts">
	import { browser } from "$app/environment";
	import { page } from "$app/stores";
	import { PROVIDERS } from "$lib/constants.js";
	import { publicEnv } from "$lib/env/public.js";
	import { signIn } from "@auth/sveltekit/client";
	import { twMerge } from "tailwind-merge";

	export let data;

	$: if (browser) {
		const hasCookie = document.cookie.includes("session-token");
		if (!$page.data.session?.user && hasCookie) location.reload();
	}

	const title = "Adventurers League Log Sheet";
	const description = "A tool for tracking your Adventurers League characters and magic items.";
	const image = "https://ddal.dekok.app/images/barovia-gate.webp";
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="title" content={title} />
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:site_name" content="Adventurers League Log Sheet" />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={image} />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="en_US" />
	<meta property="og:url" content={publicEnv.PUBLIC_URL} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:creator" content="@sillvvasensei" />
	<meta name="twitter:creator:id" content="1006748654391169029" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:site" content="Adventurers League Log Sheet" />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
	<link rel="canonical" href={publicEnv.PUBLIC_URL} />
</svelte:head>

<main class="container relative mx-auto flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
	<h1 class="text-center font-draconis text-4xl text-base-content dark:text-white lg:text-6xl">
		Adventurers League
		<br />
		Log Sheet
	</h1>
	<div class="flex flex-col gap-4">
		{#each PROVIDERS as provider}
			<button
				class="flex h-16 items-center gap-4 rounded-lg bg-base-200 px-8 py-4 text-base-content transition-colors hover:bg-base-300"
				on:click={() =>
					signIn(provider.id, {
						callbackUrl: data.redirectTo || "/characters"
					})}
				aria-label="Sign in with {provider.name}"
			>
				<span class={twMerge("iconify-color h-8 w-8", provider.iconify)}></span>
				<span class="flex h-full flex-1 items-center justify-center text-xl font-semibold">Sign In with {provider.name}</span>
			</button>
		{/each}
	</div>
	{#if data.code}
		<div class="flex justify-center">
			<div class="alert alert-error min-w-60 max-w-[28rem] shadow-lg">
				<span class="mdi--alert-circle iconify size-6 max-sm:hidden" />
				<div>
					<h3 class="font-bold">Error</h3>
					{#if data.message}<p class="mb-2 text-balance max-sm:text-sm">{data.message}</p>{/if}
					<p class="font-mono text-xs">Code: {data.code}</p>
				</div>
			</div>
		</div>
	{/if}
</main>
