<script lang="ts">
	import { browser } from "$app/environment";
	import { enhance } from "$app/forms";
	import { page } from "$app/stores";
	import { PROVIDERS } from "$lib/constants";
	import { pageLoader, searchData } from "$src/routes/(app)/+layout.svelte";
	import type { CookieStore } from "$src/server/cookie";
	import { signIn, signOut } from "@auth/sveltekit/client";
	import type { Account } from "@prisma/client";
	import { getContext, onMount } from "svelte";
	import { twMerge } from "tailwind-merge";

	export let open = false;
	const app = getContext<CookieStore<App.Cookie>>("app");

	$: accounts = $page.data.accounts as Account[];
	$: authProviders = PROVIDERS.map((p) => ({
		...p,
		account: accounts.find((a) => a.provider === p.id)
	}));

	onMount(() => {
		const mql = window.matchMedia("(prefers-color-scheme: dark)");
		mql.addEventListener("change", (ev) => {
			if ($app.settings.theme == "system") $app.settings.mode = ev.matches ? "dark" : "light";
		});
	});

	$: if (browser) {
		if ($app.settings.theme === "system") {
			const mql = window.matchMedia("(prefers-color-scheme: dark)");
			$app.settings.mode = mql.matches ? "dark" : "light";
		} else {
			$app.settings.mode = $app.settings.theme;
		}
	}
</script>

<div
	id="settings"
	class={twMerge("fixed -right-72 bottom-0 top-0 z-50 w-72 bg-base-100 px-4 py-4 transition-all", open && "right-0")}
>
	<div class="flex gap-4 p-4">
		<div class="py-2">
			<div class="avatar">
				<div
					class={twMerge(
						"relative w-[3.25rem] overflow-hidden rounded-full ring ring-primary ring-offset-2 ring-offset-base-100"
					)}
				>
					<img
						src={$page.data.session?.user?.image || ""}
						alt={$page.data.session?.user?.name}
						width={48}
						height={48}
						class="rounded-full object-cover object-center"
					/>
				</div>
			</div>
		</div>
		<div class="flex flex-1 flex-col gap-2">
			<strong>{$page.data.session?.user?.name}</strong>
			<span>
				<button class="btn btn-sm" on:click={() => signOut({ callbackUrl: "/" })}>Logout</button>
			</span>
		</div>
	</div>
	<div class="divider my-0" />
	<ul class="menu menu-lg w-full">
		<li>
			<label class="flex flex-row items-center gap-2 hover:bg-transparent">
				<span class="flex-1">Theme</span>
				<select class="select select-bordered select-sm" bind:value={$app.settings.theme}>
					<option value="system">System</option>
					<option value="light">Light</option>
					<option value="dark">Dark</option>
				</select>
			</label>
		</li>
		{#if !$page.data.mobile}
			<li class="hidden rounded-lg lg:flex">
				<label class="flex flex-row items-center">
					<span class="flex-1 text-left">Background</span>
					<input type="checkbox" class="toggle" bind:checked={$app.settings.background} />
				</label>
			</li>
		{/if}
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
		<ul class="menu menu-lg w-full">
			<li class="menu-title">
				<span class="font-bold">Linked Accounts</span>
			</li>
			{#each authProviders as provider}
				<li>
					<label class="flex justify-between">
						<span>{provider.name}</span>
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
	<ul class="menu menu-lg w-full">
		<li>
			<a href="https://github.com/sillvva/ddal-svelte" target="_blank" rel="noreferrer noopener">
				<span class="iconify mdi-github size-6" />
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
	.menu-lg li {
		height: 3.5rem;
	}
	.menu-lg li * {
		line-height: 2rem;
	}
</style>
