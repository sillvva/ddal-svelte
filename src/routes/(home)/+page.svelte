<script lang="ts">
	import { page } from "$app/state";
	import { authClient } from "$lib/auth";
	import { PROVIDERS } from "$lib/constants";
	import { errorToast } from "$lib/factories.svelte.js";
	import { getGlobal } from "$lib/stores.svelte.js";
	import { twMerge } from "tailwind-merge";

	let { data } = $props();

	const global = getGlobal();

	$effect(() => {
		if (global.app.settings.autoWebAuthn) {
			authClient.signIn.passkey({
				fetchOptions: {
					onSuccess: () => {
						window.location.href = data.redirectTo || "/characters";
					}
				}
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
	<meta property="og:url" content={page.url.origin} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:site" content="Adventurers League Log Sheet" />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
	<link rel="canonical" href={page.url.href} />
</svelte:head>

<main class="relative container mx-auto flex min-h-dvh flex-col items-center justify-center gap-8 p-4">
	<h1 class="font-draconis text-base-content text-center text-4xl lg:text-6xl dark:text-white">
		Adventurers League
		<br />
		Log Sheet
	</h1>
	<div class="max-xs:max-w-60 max-xs:gap-3 flex max-w-80 flex-col gap-4">
		{#each PROVIDERS as provider}
			<button
				class="bg-base-200 text-base-content hover:bg-base-300 max-xs:h-12 max-xs:px-4 flex h-16 items-center gap-4 rounded-lg px-8 py-4 transition-colors"
				onclick={() => {
					console.log("Signing in with", provider.name);
					authClient.signIn
						.social({
							provider: provider.id,
							callbackURL: data.redirectTo || "/characters"
						})
						.then((result) => {
							if (result.error?.message) {
								console.error(result.error);
								errorToast(result.error.message);
							}
							return result;
						});
				}}
				aria-label="Sign in with {provider.name}"
			>
				<span class={twMerge("iconify-color max-xs:size-5 size-8", provider.iconify)}></span>
				<span class="max-xs:text-base flex h-full flex-1 items-center justify-center text-xl font-semibold"
					>Sign In with {provider.name}</span
				>
			</button>
		{/each}
		<hr class="border-base-content" />
		<button
			class="bg-base-200 text-base-content hover:bg-base-300 max-xs:h-12 max-xs:px-4 flex h-16 items-center gap-4 rounded-lg px-8 py-4 transition-colors"
			onclick={() => {
				console.log("Signing in with Passkey");
				authClient.signIn.passkey({
					fetchOptions: {
						onSuccess: () => {
							window.location.href = data.redirectTo || "/characters";
						}
					}
				});
			}}
			aria-label="Sign in with Passkey"
		>
			<span class="iconify material-symbols--passkey max-xs:size-5 size-8"></span>
			<span class="max-xs:text-base flex h-full flex-1 items-center justify-center text-xl font-semibold"
				>Sign In with Passkey</span
			>
		</button>
		<span class="text-base-content text-center text-xs text-pretty">
			You must have an account and then add a Passkey in settings before you can sign in with a Passkey.
		</span>
		<div class="card bg-primary/50 shadow-sm">
			<div class="card-body p-4">
				<h3 class="text-xl">Important Notice</h3>
				<p class="text-base-content text-xs text-pretty">
					Authentication has been migrated to a new API. If you had a Passkey prior to July 8th, 2025, you will need to sign in
					with another method and then add it again.
				</p>
			</div>
		</div>
	</div>
</main>
