<script lang="ts">
	import { PROVIDERS } from "$lib/constants.js";
	import { publicEnv } from "$lib/env/public.js";
	import { global } from "$lib/stores.svelte.js";
	import { signIn } from "@auth/sveltekit/client";
	import { signIn as passkey } from "@auth/sveltekit/webauthn";
	import { twMerge } from "tailwind-merge";

	let { data } = $props();

	$effect(() => {
		if (global.app.settings.autoWebAuthn) {
			passkey("webauthn", {
				callbackUrl: data.redirectTo || "/characters",
				action: "authenticate"
			});
		}
	});

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

<main class="relative container mx-auto flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
	<h1 class="font-draconis text-base-content text-center text-4xl lg:text-6xl dark:text-white">
		Adventurers League
		<br />
		Log Sheet
	</h1>
	<div class="flex flex-col gap-4">
		{#each PROVIDERS as provider}
			<button
				class="bg-base-200 text-base-content hover:bg-base-300 flex h-16 items-center gap-4 rounded-lg px-8 py-4 transition-colors"
				onclick={() => {
					console.log("Signing in with", provider.name);
					signIn(provider.id, {
						callbackUrl: data.redirectTo || "/characters"
					})
						.then(console.log)
						.catch(console.error);
				}}
				aria-label="Sign in with {provider.name}"
			>
				<span class={twMerge("iconify-color h-8 w-8", provider.iconify)}></span>
				<span class="flex h-full flex-1 items-center justify-center text-xl font-semibold">Sign In with {provider.name}</span>
			</button>
		{/each}
		<hr class="border-base-content" />
		<button
			class="bg-base-200 text-base-content hover:bg-base-300 flex h-16 items-center gap-4 rounded-lg px-8 py-4 transition-colors"
			onclick={() => {
				console.log("Signing in with Passkey");
				passkey("webauthn", {
					callbackUrl: data.redirectTo || "/characters",
					action: "authenticate"
				})
					.then(console.log)
					.catch(console.error);
			}}
			aria-label="Sign in with Passkey"
		>
			<span class="iconify material-symbols--passkey h-8 w-8"></span>
			<span class="flex h-full flex-1 items-center justify-center text-xl font-semibold">Sign In with Passkey</span>
		</button>
		<span class="text-base-content max-w-72 text-center text-xs text-balance">
			You must have an account and add a Passkey in settings before you can sign in with this.
		</span>
	</div>
	{#if data.code}
		<div class="flex justify-center">
			<div class="alert alert-error max-w-[28rem] min-w-60 shadow-lg">
				<span class="iconify mdi--alert-circle size-6 max-sm:hidden"></span>
				<div>
					<h3 class="font-bold">Error</h3>
					{#if data.message}<p class="mb-2 max-sm:text-sm">{data.message}</p>{/if}
					<p class="font-mono text-xs">Code: {data.code}</p>
				</div>
			</div>
		</div>
	{/if}
</main>
