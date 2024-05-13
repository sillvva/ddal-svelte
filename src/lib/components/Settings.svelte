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
	class={twMerge(
		"fixed -right-80 bottom-0 top-0 z-50 flex w-80 flex-col overflow-y-auto bg-base-100 px-4 py-4 transition-all",
		open && "right-0"
	)}
>
	{#if $page.data.session}
		<div class="flex items-center gap-4 py-4 pl-2">
			<div
				class="avatar flex h-9 w-9 items-center justify-center rounded-full ring ring-primary ring-offset-2 ring-offset-base-100"
			>
				{#if $page.data.session.user.image}
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
				<div class="overflow-hidden text-ellipsis whitespace-nowrap font-medium">{$page.data.session.user.name}</div>
				<div class="overflow-hidden text-ellipsis text-xs font-medium text-gray-500 dark:text-gray-400">
					{$page.data.session.user.email}
				</div>
			</div>
			<button class="btn p-3" on:click={() => signOut({ callbackUrl: "/" })} aria-label="Sign out">
				<i class="iconify h-5 w-5 mdi--logout" />
			</button>
		</div>
	{/if}
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
						<span class={twMerge("iconify-color h-6 w-6", provider.iconify)}></span>
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
			<a href="https://github.com/sillvva/ddal-svelte/issues" target="_blank" rel="noreferrer noopener">
				<span class="iconify size-6 mdi--bug" />
				Report a bug
			</a>
		</li>
		<li>
			<a href="https://matt.dekok.dev" target="_blank" rel="noreferrer noopener">
				<span class="iconify size-6 mdi--information-outline" />
				About the developer
			</a>
		</li>
		<li>
			<a href="http://paypal.me/Sillvva" target="_blank" rel="noreferrer noopener">
				<span class="iconify size-6 mdi--gift" />
				Contribute
			</a>
		</li>
	</ul>
	<div class="flex-1"></div>

	{#if $page.data.session}
		<div class="px-4 text-xs text-gray-500 dark:text-gray-400">
			User ID: {$page.data.session.user.id}
		</div>
	{/if}
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
