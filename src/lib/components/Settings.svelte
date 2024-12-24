<script lang="ts">
	import { enhance } from "$app/forms";
	import { page } from "$app/state";
	import { PROVIDERS } from "$lib/constants";
	import { successToast } from "$lib/factories.svelte";
	import { global } from "$lib/stores.svelte";
	import { setCookie } from "$server/cookie";
	import { signIn, signOut } from "@auth/sveltekit/client";
	import { twMerge } from "tailwind-merge";
	import Passkeys from "./Passkeys.svelte";
	import ThemeSwitcher from "./ThemeSwitcher.svelte";

	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	const user = $derived(page.data.user);
	const authProviders = $derived(
		PROVIDERS.map((p) => ({
			...p,
			account: user?.accounts.find((a) => a.provider === p.id)
		}))
	);
	const initials = $derived(
		user?.name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.slice(0, 2) || ""
	);

	$effect(() => {
		setCookie("app", global.app);
	});
</script>

<aside
	id="settings"
	class="fixed inset-y-0 -right-80 z-50 flex w-80 flex-col overflow-y-auto bg-base-100 px-4 py-4 transition-all data-[open=true]:right-0"
	data-open={open}
>
	{#if user}
		<div class="flex items-center gap-4 py-4 pl-2">
			<div
				class="avatar flex h-9 w-9 items-center justify-center rounded-full ring ring-primary ring-offset-2 ring-offset-base-100"
			>
				{#if user.image}
					<img src={user.image} alt={user.name} width={48} height={48} class="rounded-full object-cover object-center" />
				{:else if initials}
					<span class="text-xl font-bold uppercase text-primary">{initials}</span>
				{/if}
			</div>
			<div class="flex-1">
				<div class="overflow-hidden text-ellipsis whitespace-nowrap font-medium">{user.name}</div>
				<div class="overflow-hidden text-ellipsis text-xs font-medium text-gray-500 dark:text-gray-400">
					{user.email}
				</div>
			</div>
			<button class="btn p-3" onclick={() => signOut({ callbackUrl: "/" })} aria-label="Sign out">
				<i class="iconify h-5 w-5 mdi--logout"></i>
			</button>
		</div>
		<div class="divider my-0"></div>
		<ul class="menu menu-lg w-full px-0">
			<li>
				<div class="flex items-center gap-2 hover:bg-transparent">
					<span class="flex-1">Theme</span>
					<ThemeSwitcher />
				</div>
			</li>
		</ul>
		<div class="divider my-0"></div>
		<ul class="menu menu-lg w-full px-0 [&_li>*]:px-2">
			<li class="menu-title">
				<span class="font-bold">Linked Accounts</span>
			</li>
			{#each authProviders as provider}
				<li>
					<label class="flex gap-2 hover:bg-transparent">
						<span class={twMerge("size=6 iconify-color", provider.iconify)}></span>
						<span class="flex-1">{provider.name}</span>
						<span class="flex items-center">
							{#if provider.account}
								{#if user.accounts.length > 1}
									<form
										method="POST"
										action="/characters?/unlinkProvider"
										use:enhance={({ cancel }) => {
											if (!confirm(`Are you sure you want to unlink ${provider.name}?`)) return cancel();

											global.pageLoader = true;
											open = false;
											return async ({ update }) => {
												await update();
												global.pageLoader = false;
												successToast(`${provider.name} unlinked`);
											};
										}}
									>
										<input type="hidden" name="provider" value={provider.id} />
										<button class="btn btn-error btn-sm">Unlink</button>
									</form>
								{:else}
									<span class="iconify size-6 text-green-500 mdi--check"></span>
								{/if}
							{:else}
								<button class="btn btn-primary btn-sm" onclick={() => signIn(provider.id, { callbackUrl: page.url.href })}>
									Link
								</button>
							{/if}
						</span>
					</label>
				</li>
			{/each}
		</ul>
		<Passkeys />
		<div class="divider my-0"></div>
		<ul class="menu menu-lg w-full px-0">
			<li>
				<a href="https://github.com/sillvva/ddal-svelte/issues" target="_blank" rel="noreferrer noopener">
					<span class="iconify size-6 mdi--bug"></span>
					Report a bug
				</a>
			</li>
			<li>
				<a href="https://matt.dekok.dev" target="_blank" rel="noreferrer noopener">
					<span class="iconify size-6 mdi--information-outline"></span>
					About the developer
				</a>
			</li>
			<li>
				<a href="http://paypal.me/Sillvva" target="_blank" rel="noreferrer noopener">
					<span class="iconify size-6 mdi--gift"></span>
					Contribute
				</a>
			</li>
		</ul>
		<div class="flex-1"></div>

		<div class="px-4 text-xs text-gray-500 dark:text-gray-400">
			User ID: {user.id}
		</div>
	{/if}
</aside>
<div
	class="fixed inset-0 -z-10 hidden bg-base-300/50 opacity-0 transition-all data-[open=true]:z-40 data-[open=true]:block data-[open=true]:opacity-100"
	onkeydown={() => (open = false)}
	onclick={() => (open = false)}
	role="none"
	data-open={open}
></div>

<style>
	aside {
		:global(.menu-lg li *) {
			line-height: 1.5rem;
		}

		:global(.menu-title) {
			padding-block: 0;
		}

		:global(.menu li) {
			padding-inline: 0;
		}

		:global(.menu li > *) {
			padding-inline: 1rem;
		}

		:global(.menu li button) {
			padding-inline: 1rem;
			justify-content: start;
			font-weight: normal;
		}

		:global(.menu li > :not(button, a):hover) {
			background-color: transparent !important;
			cursor: default;
		}
	}
</style>
