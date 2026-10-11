<script lang="ts">
	import { authClient } from "#lib/auth.js";
	import { PROVIDERS } from "#lib/constants.js";
	import { errorToast } from "#lib/factories.svelte.js";
	import * as API from "#lib/remote/index.js";
	import { getGlobal } from "#lib/stores.svelte.js";
	import { page } from "$app/state";
	import { onMount } from "svelte";

	const global = getGlobal();

	const home = $derived(
		await API.app.queries.home({
			redirect: page.url.searchParams.get("redirect"),
			error: page.url.searchParams.get("error"),
			errorDescription: page.url.searchParams.get("error_description")
		})
	);

	const lastMethod = authClient.getLastUsedLoginMethod();
	let showPasskeyWarning = $state(false);

	onMount(async () => {
		if (global.app.settings.autoWebAuthn) {
			const { data, error } = await authClient.signIn.passkey();
			if (data) {
				window.location.href = home.redirectTo || "/characters";
			} else if (error) {
				console.error(error);
				errorToast(error.message ?? "An unknown error occurred");
			}
		}
	});
</script>

<main class="relative container mx-auto flex flex-1 flex-col items-center justify-center gap-8 p-4 pb-20">
	<div class="flex flex-col items-center">
		{#if !showPasskeyWarning}
			<img src="/images/{global.app.settings.mode === 'dark' ? 'dragon' : 'dragon-dark'}.webp" alt="Dragon" class="size-40" />
		{/if}
		<h1 class="text-center font-draconis text-4xl text-base-content lg:text-6xl dark:text-white">
			<span class="text-[75%]">Adventurers League</span>
			<br />
			Log Sheet
		</h1>
	</div>
	<div class="flex max-w-80 flex-col gap-4 max-xs:max-w-80 max-xs:gap-3">
		{#if home.error}
			<div class="flex justify-center">
				<div class="alert max-w-md min-w-60 alert-error shadow-lg">
					<span class="iconify size-6 mdi--alert-circle max-sm:hidden"></span>
					<div>
						<h2 class="font-bold">Error</h2>
						{#if home.error.message}<p class="mb-2 max-sm:text-sm">{home.error.message}</p>{/if}
						<p class="font-mono text-xs">Code: {home.error.code}</p>
					</div>
				</div>
			</div>
		{/if}
		{#if !home.error || home.error.code !== "BANNED"}
			{#each PROVIDERS as provider (provider.id)}
				<button
					class="relative flex h-16 items-center gap-4 rounded-lg bg-base-200 px-8 py-4 text-base-content transition-colors hover:bg-base-300 max-xs:h-12 max-xs:justify-center max-xs:px-4"
					onclick={async () => {
						console.log("Signing in with", provider.name);
						const { error } = await authClient.signIn.social({
							provider: provider.id,
							callbackURL: home.redirectTo || "/characters"
						});
						if (error) {
							console.error(error);
							errorToast(error.message ?? "An unknown error occurred");
						}
					}}
					aria-label="Sign in with {provider.name}"
				>
					<span class={["iconify-color size-8 max-xs:size-5", provider.iconify]}></span>
					<span class="flex h-full items-center justify-center text-xl font-semibold max-xs:text-base xs:flex-1"
						>Sign In with {provider.name}</span
					>
					{#if lastMethod === provider.id}
						<span class="absolute top-0 right-0 badge translate-x-1/2 -translate-y-1/2 badge-soft badge-primary">
							Last used
						</span>
					{/if}
				</button>
			{/each}
			<hr class="border-base-content" />
			<button
				class="relative flex h-16 items-center gap-4 rounded-lg bg-base-200 px-8 py-4 text-base-content transition-colors hover:bg-base-300 max-xs:h-12 max-xs:justify-center max-xs:px-4"
				onclick={async () => {
					console.log("Signing in with Passkey");
					showPasskeyWarning = true;
					const { data, error } = await authClient.signIn.passkey();
					if (data) {
						window.location.href = home.redirectTo || "/characters";
					} else if (error?.message) {
						console.error(error);
						errorToast(error.message);
					}
				}}
				aria-label="Sign in with Passkey"
			>
				<span class="iconify size-8 material-symbols--passkey max-xs:size-5"></span>
				<span class="flex h-full items-center justify-center text-xl font-semibold max-xs:text-base xs:flex-1"
					>Sign In with Passkey</span
				>

				{#if lastMethod === "passkey"}
					<span class="absolute top-0 right-0 badge translate-x-1/2 -translate-y-1/2 badge-soft badge-primary"> Last used </span>
				{/if}
			</button>
			<span class="text-center text-xs text-pretty text-base-content">
				You must have an account and then add a Passkey in settings before you can sign in with a Passkey.
			</span>
		{/if}
	</div>
</main>
