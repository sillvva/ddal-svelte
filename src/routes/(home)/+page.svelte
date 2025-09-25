<script lang="ts">
	import { authClient } from "$lib/auth";
	import { PROVIDERS } from "$lib/constants";
	import { errorToast } from "$lib/factories.svelte.js";
	import * as API from "$lib/remote";
	import { getGlobal } from "$lib/stores.svelte.js";

	const global = getGlobal();

	const data = await API.app.queries.home();
	const lastMethod = authClient.getLastUsedLoginMethod();

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
</script>

<main class="relative container mx-auto flex flex-1 flex-col items-center justify-center gap-8 p-4 pb-20">
	<h1 class="font-draconis text-base-content text-center text-4xl lg:text-6xl dark:text-white">
		Adventurers League
		<br />
		Log Sheet
	</h1>
	<div class="max-xs:max-w-80 max-xs:gap-3 flex max-w-80 flex-col gap-4">
		{#if data.error}
			<div class="flex justify-center">
				<div class="alert alert-error max-w-[28rem] min-w-60 shadow-lg">
					<span class="iconify mdi--alert-circle size-6 max-sm:hidden"></span>
					<div>
						<h3 class="font-bold">Error</h3>
						{#if data.error.message}<p class="mb-2 max-sm:text-sm">{data.error.message}</p>{/if}
						<p class="font-mono text-xs">Code: {data.error.code}</p>
					</div>
				</div>
			</div>
		{/if}
		{#if !data.error || data.error.code !== "BANNED"}
			{#each PROVIDERS as provider (provider.id)}
				<button
					class="bg-base-200 text-base-content max-xs:justify-center hover:bg-base-300 max-xs:h-12 max-xs:px-4 relative flex h-16 items-center gap-4 rounded-lg px-8 py-4 transition-colors"
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
					<span class={["iconify-color max-xs:size-5 size-8", provider.iconify]}></span>
					<span class="max-xs:text-base xs:flex-1 flex h-full items-center justify-center text-xl font-semibold"
						>Sign In with {provider.name}</span
					>
					{#if lastMethod === provider.id}
						<span class="badge badge-soft badge-primary absolute top-0 right-0 translate-x-1/2 -translate-y-1/2">
							Last used
						</span>
					{/if}
				</button>
			{/each}
			<hr class="border-base-content" />
			<button
				class="bg-base-200 text-base-content max-xs:justify-center hover:bg-base-300 max-xs:h-12 max-xs:px-4 flex h-16 items-center gap-4 rounded-lg px-8 py-4 transition-colors"
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
				<span class="max-xs:text-base xs:flex-1 flex h-full items-center justify-center text-xl font-semibold"
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
		{/if}
	</div>
</main>
