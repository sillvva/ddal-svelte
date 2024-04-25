<script lang="ts">
	import { enhance } from "$app/forms";
	import { page } from "$app/stores";
	import { PROVIDERS } from "$lib/constants";
	import { pageLoader, searchData } from "$lib/stores";
	import type { CookieStore } from "$server/cookie";
	import type { Account } from "$server/db/schema";
	import { signIn, signOut } from "@auth/sveltekit/client";
	import { getContext } from "svelte";
	import { twMerge } from "tailwind-merge";
	import ThemeSwitcher from "./ThemeSwitcher.svelte";

	export let open = false;
	const app = getContext<CookieStore<App.Cookie>>("app");

	$: accounts = $page.data.accounts as Account[];
	$: authProviders = PROVIDERS.map((p) => ({
		...p,
		account: accounts.find((a) => a.provider === p.id)
	}));

	$: initials =
		$page.data.session?.user.name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.slice(0, 2) || "";
</script>

<div
	id="settings"
	class={twMerge("fixed -right-80 bottom-0 top-0 z-50 w-80 bg-base-100 px-4 py-4 transition-all", open && "right-0")}
>
	<div class="flex items-center gap-4 py-4 pl-2">
		<div
			class="avatar flex h-9 w-9 items-center justify-center rounded-full ring ring-primary ring-offset-2 ring-offset-base-100"
		>
			{#if $page.data.session?.user?.image}
				<img
					src={$page.data.session.user.image}
					alt={$page.data.session.user.name}
					width={48}
					height={48}
					class="rounded-full object-cover object-center"
				/>
			{:else if initials}
				<span class="text-xl font-bold uppercase text-primary">{initials}</span>
			{/if}
		</div>
		<div class="flex-1">
			<div class="overflow-hidden text-clip whitespace-nowrap font-medium">{$page.data.session?.user?.name}</div>
			{#if $page.data.session?.user?.email}
				<div class="overflow-hidden text-clip text-xs font-medium text-gray-500 dark:text-gray-400">
					{$page.data.session.user.email}
				</div>
			{/if}
		</div>
		<button class="btn p-3" on:click={() => signOut({ callbackUrl: "/" })}>
			<i class="iconify h-5 w-5 mdi-logout" />
			<span class="sr-only">Sign out</span>
		</button>
	</div>
	<div class="divider my-0" />
	<ul class="menu menu-lg w-full px-0">
		<li>
			<div class="flex items-center gap-2 hover:bg-transparent">
				<span class="flex-1">Theme</span>
				<ThemeSwitcher />
			</div>
		</li>
		<form
			method="POST"
			action="/characters?/clearCaches"
			use:enhance={() => {
				$pageLoader = true;
				open = false;
				return async ({ update }) => {
					await update();
					$searchData = [];
					$pageLoader = false;
				};
			}}
		>
			<li class="rounded-lg">
				<button class="size-full">Clear Cache</button>
			</li>
		</form>
	</ul>
	{#if authProviders.length > 0}
		<div class="divider my-0" />
		<ul class="menu menu-lg w-full px-0 [&_li>*]:px-2">
			<li class="menu-title">
				<span class="font-bold">Linked Accounts</span>
			</li>
			{#each authProviders as provider}
				<li>
					<label class="flex gap-2">
						{#if provider.id === "google"}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 256 262"
								><path
									fill="#4285f4"
									d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
								/><path
									fill="#34a853"
									d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
								/><path
									fill="#fbbc05"
									d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
								/><path
									fill="#eb4335"
									d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
								/></svg
							>
						{/if}
						{#if provider.id === "discord"}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 256 199"
								><path
									fill="#5865f2"
									d="M216.856 16.597A208.502 208.502 0 0 0 164.042 0c-2.275 4.113-4.933 9.645-6.766 14.046c-19.692-2.961-39.203-2.961-58.533 0c-1.832-4.4-4.55-9.933-6.846-14.046a207.809 207.809 0 0 0-52.855 16.638C5.618 67.147-3.443 116.4 1.087 164.956c22.169 16.555 43.653 26.612 64.775 33.193A161.094 161.094 0 0 0 79.735 175.3a136.413 136.413 0 0 1-21.846-10.632a108.636 108.636 0 0 0 5.356-4.237c42.122 19.702 87.89 19.702 129.51 0a131.66 131.66 0 0 0 5.355 4.237a136.07 136.07 0 0 1-21.886 10.653c4.006 8.02 8.638 15.67 13.873 22.848c21.142-6.58 42.646-16.637 64.815-33.213c5.316-56.288-9.08-105.09-38.056-148.36M85.474 135.095c-12.645 0-23.015-11.805-23.015-26.18s10.149-26.2 23.015-26.2c12.867 0 23.236 11.804 23.015 26.2c.02 14.375-10.148 26.18-23.015 26.18m85.051 0c-12.645 0-23.014-11.805-23.014-26.18s10.148-26.2 23.014-26.2c12.867 0 23.236 11.804 23.015 26.2c0 14.375-10.148 26.18-23.015 26.18"
								/></svg
							>
						{/if}
						<span>{provider.name}</span>
						<span class="flex-1"></span>
						<span>
							{#if provider.account}
								{#if accounts.length > 1}
									<form
										method="POST"
										action="/characters?/unlinkProvider"
										use:enhance={() => {
											$pageLoader = true;
											open = false;
											return async ({ update }) => {
												await update();
												$pageLoader = false;
											};
										}}
									>
										<input type="hidden" name="provider" value={provider.id} />
										<button class="btn btn-error btn-sm">Unlink</button>
									</form>
								{:else}
									Linked
								{/if}
							{:else}
								<button
									class="btn btn-primary btn-sm"
									on:click={() =>
										signIn(provider.id, {
											callbackUrl: `${$page.url.origin}${$page.url.pathname}${$page.url.search}`
										})}>Link</button
								>
							{/if}
						</span>
					</label>
				</li>
			{/each}
		</ul>
	{/if}
	<div class="divider my-0" />
	<ul class="menu menu-lg w-full px-0">
		<li>
			<a href="https://github.com/sillvva/ddal-svelte" target="_blank" rel="noreferrer noopener">
				<span class="iconify size-6 mdi-github" />
				Github
			</a>
		</li>
		<!-- <li>
			<a href="http://paypal.me/Sillvva" target="_blank" rel="noreferrer noopener">Contribute</a>
		</li> -->
	</ul>
</div>
<div
	class={twMerge(
		"fixed inset-0 bg-base-300/50 transition-all",
		open ? "block" : "hidden",
		open ? "z-40 opacity-100" : "-z-10 opacity-0"
	)}
	on:keydown={() => (open = false)}
	on:click={() => (open = false)}
	role="none"
/>

<style>
	.menu-lg li:not(.menu-title) {
		height: 3.5rem;
	}
	.menu-lg li * {
		line-height: 2rem;
	}

	.menu-title {
		padding-block: 0;
	}

	.menu li {
		padding-inline: 0;
	}

	:where(.menu li > *) {
		padding-inline: 1rem;
	}

	:where(.menu li > :not(button, a):hover) {
		background-color: transparent;
		cursor: default;
	}
</style>
