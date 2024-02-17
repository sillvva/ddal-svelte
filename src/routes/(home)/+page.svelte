<script lang="ts">
	import { browser } from "$app/environment";
	import { page } from "$app/stores";
	import Icon from "$lib/components/Icon.svelte";
	import { PROVIDERS } from "$lib/constants.js";
	import type { CookieStore } from "$src/server/cookie.js";
	import { signIn } from "@auth/sveltekit/client";
	import { getContext } from "svelte";
	import { twMerge } from "tailwind-merge";

	export let data;

	const app = getContext<CookieStore<App.Cookie>>("app");

	$: if (browser) {
		const hasCookie = document.cookie.includes("session-token");
		if (!$page.data.session?.user && hasCookie) location.reload();
	}

	const title = "Adventurers League Log Sheet";
	const description = "A tool for tracking your Adventurers League characters and magic items.";
	const image = "https://ddal.dekok.app/images/barovia-gate.webp";

	let code = $page.url.searchParams.get("code");
	if (code === "undefined") code = "UnknownError";
	const message = $page.url.searchParams.get("message");
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
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:creator" content="@sillvvasensei" />
	<meta name="twitter:creator:id" content="1006748654391169029" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:site" content="Adventurers League Log Sheet" />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
</svelte:head>

<main class="container relative mx-auto flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
	<h1 class="text-center font-draconis text-4xl text-base-content dark:text-white lg:text-6xl">
		Adventurers League
		<br />
		Log Sheet
	</h1>
	{#if code}
		<div class="flex justify-center">
			<div class="alert alert-error w-80 shadow-lg">
				<Icon src="alert-circle" class="w-6" />
				<div>
					<h3 class="font-bold">Error: {code}</h3>
					{#if message !== null}<div class="text-xs">{message || "Something went wrong"}</div>{/if}
				</div>
			</div>
		</div>
	{/if}
	<div class="flex flex-col gap-4">
		{#each PROVIDERS as provider}
			<button
				class={twMerge(
					"flex h-16 items-center gap-4 rounded-lg px-8 py-4 text-base-content transition-colors hover:bg-base-300",
					$app.settings.background ? "bg-base-200/50" : "bg-base-200"
				)}
				on:click={() =>
					signIn(provider.id, {
						callbackUrl: `${$page.url.origin}${data.redirectTo || "/characters"}`
					})}
				aria-label="Sign in with {provider.name}"
			>
				<img src={provider.logo} width="32" height="32" alt={provider.name} />
				<span class="flex h-full flex-1 items-center justify-center text-xl font-semibold">Sign In with {provider.name}</span>
			</button>
		{/each}
	</div>
	{#if PROVIDERS.length > 1}
		<div class="flex gap-4">
			<a
				href="/"
				class="tooltip tooltip-bottom tooltip-open mb-32 text-white before:text-warning-content"
				data-tip={"To link multiple auth providers to the same account, first sign in to your main account. " +
					"Then link additional auth providers in the settings menu. " +
					"If you sign in with a second provider here before linking, it will create a separate account. " +
					"If this happens, the accounts cannot be linked."}
			>
				Tip: Linking Accounts
			</a>
		</div>
	{/if}
</main>

<style>
	.tooltip {
		--tooltip-color: oklch(var(--wa) / 0.6);
	}
</style>
