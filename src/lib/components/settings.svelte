<script lang="ts">
	import { goto, invalidateAll } from "$app/navigation";
	import { page } from "$app/state";
	import { authClient } from "$lib/auth";
	import { BLANK_CHARACTER, PROVIDERS, type ProviderId } from "$lib/constants";
	import { errorToast, parseEffectResult } from "$lib/factories.svelte";
	import * as API from "$lib/remote";
	import { getGlobal } from "$lib/stores.svelte";
	import { isDefined } from "@sillvva/utils";
	import { isTupleOfAtLeast } from "effect/Predicate";
	import Passkeys from "./passkeys.svelte";
	import ThemeSwitcher from "./theme-switcher.svelte";

	interface Props {
		open: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	const global = getGlobal();

	type UserAccount = { providerId: ProviderId; name: string; email: string; image: string };
	let userAccounts = $state<UserAccount[]>([]);

	const currentAccount = $derived(userAccounts.find((a) => a.providerId === global.app.settings.provider));
	const authProviders = $derived(
		PROVIDERS.map((p) => ({
			...p,
			account: global.user?.accounts.find((a) => a.providerId === p.id)
		}))
	);
	const initials = $derived(
		global.user?.name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.slice(0, 2) || ""
	);

	$effect(() => {
		if (!userAccounts.length && open) {
			Promise.allSettled(
				global.user?.accounts.map(({ accountId, providerId }) =>
					authClient.accountInfo({ accountId }).then((r) =>
						r.data?.user?.name && r.data?.user?.email && r.data?.user?.image
							? {
									providerId,
									name: r.data?.user.name,
									email: r.data?.user.email,
									image: r.data?.user.image
								}
							: undefined
					)
				) ?? []
			).then(async (result) => {
				userAccounts = result.map((r) => (r.status === "fulfilled" ? r.value : undefined)).filter(isDefined);

				const account =
					userAccounts.find((a) => a.providerId === global.app.settings.provider) ||
					userAccounts.find((a) => a.name === global.user?.name && a.email === global.user?.email) ||
					(isTupleOfAtLeast(userAccounts, 1) ? userAccounts[0] : undefined);

				if (account) {
					if (!global.app.settings.provider) {
						global.app.settings.provider = account.providerId;
					}
					if (
						account.name !== global.user?.name ||
						account.email !== global.user?.email ||
						(account.image !== global.user?.image && !account.image.includes(BLANK_CHARACTER))
					) {
						const result = await API.auth.actions.updateUser(account);
						const parsed = await parseEffectResult(result);
						if (parsed) await global.refresh();
					}
				}
			});
		}
	});
</script>

{#if global.user}
	<aside
		id="settings"
		class="bg-base-100 fixed inset-y-0 -right-80 z-50 flex w-80 flex-col overflow-y-auto px-4 pb-4 transition-all data-[open=true]:right-0 data-[open=true]:shadow-lg data-[open=true]:shadow-black/50 print:hidden"
		data-open={open}
	>
		{#if global.user}
			<div class="flex items-center gap-4 py-4 pl-2">
				<div
					class="avatar ring-primary group/avatar bg-primary ring-offset-base-100 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-3 ring-offset-2"
				>
					{#if global.user.image}
						<img
							src={global.user.image}
							alt={global.user.name}
							class="rounded-full object-cover object-center"
							onerror={(e) => {
								const img = e.currentTarget as HTMLImageElement;
								img.onerror = null;
								img.src = BLANK_CHARACTER;
							}}
						/>
					{:else if initials}
						<span class="text-primary text-xl font-bold uppercase">{initials}</span>
					{/if}
				</div>
				<div class="flex-1">
					<div class="ellipsis-nowrap font-medium">{global.user.name}</div>
					<div class="ellipsis-nowrap text-xs font-medium text-gray-500 dark:text-gray-400">
						{global.user.email}
					</div>
				</div>
				{#if global.session?.impersonatedBy}
					<div class="tooltip tooltip-left" data-tip="Stop impersonating">
						<button
							class="btn btn-sm btn-primary"
							aria-label="Stop impersonating"
							onclick={async () => {
								await authClient.admin.stopImpersonating();
								await goto("/admin/users");
								await invalidateAll();
								open = false;
							}}
						>
							<span class="iconify mdi--account-switch"></span>
						</button>
					</div>
				{:else}
					<div class="tooltip tooltip-left" data-tip="Sign out">
						<button
							class="btn p-3"
							aria-label="Sign out"
							onclick={() =>
								authClient.signOut({
									fetchOptions: {
										onSuccess: () => {
											goto(`/?redirect=${encodeURIComponent(`${page.url.pathname}${page.url.search}`)}`);
										}
									}
								})}
						>
							<i class="iconify mdi--logout h-5 w-5"></i>
						</button>
					</div>
				{/if}
			</div>
			<div class="divider my-0 h-[9px]"></div>
			<ul class="menu menu-lg w-full px-0">
				<li>
					<div class="flex items-center gap-2 hover:bg-transparent">
						<span class="flex-1">Theme</span>
						<ThemeSwitcher />
					</div>
				</li>
			</ul>
			<div class="divider my-0 h-[9px]"></div>
			<ul class="menu menu-lg w-full px-0 [&_li>*]:px-2">
				<li class="menu-title">
					<span class="font-bold">Linked Accounts</span>
				</li>
				{#each authProviders as provider (provider.id)}
					<li>
						<span class="flex gap-2 hover:bg-transparent">
							<span class={["size=6 iconify-color", provider.iconify]}></span>
							<span class="flex-1">{provider.name}</span>
							<span class="join flex items-center">
								{#if provider.account}
									{#if global.user.accounts.length > 1}
										{#if !userAccounts.length}
											<span class="iconify mdi--loading size-5 animate-spin"></span>
										{:else}
											{@const account = userAccounts.find((a) => a.providerId === provider.id)}
											{#if account}
												{#if currentAccount?.providerId !== provider.id || account.name !== global.user.name || account.email !== global.user.email || account.image !== global.user.image}
													<div class="tooltip" data-tip="Use this account">
														<button
															class="btn btn-sm join-item bg-base-300"
															aria-label="Switch account"
															disabled={!!API.auth.actions.updateUser.pending}
															onclick={async () => {
																const result = await API.auth.actions.updateUser(account);
																const parsed = await parseEffectResult(result);
																if (parsed) {
																	global.app.settings.provider = account.providerId;
																	await global.refresh();
																}
															}}
														>
															<span class="iconify mdi--accounts-switch size-5"></span>
														</button>
													</div>
												{/if}
											{/if}
											<button
												class="btn btn-error btn-sm join-item font-semibold"
												disabled={currentAccount?.providerId === provider.id || !!API.auth.actions.updateUser.pending}
												onclick={async () => {
													if (confirm("Are you sure you want to unlink this account?")) {
														const result = await authClient.unlinkAccount({ providerId: provider.id });
														if (result.error?.code) {
															return errorToast(
																authClient.$ERROR_CODES[result.error.code as keyof typeof authClient.$ERROR_CODES]
															);
														}
														invalidateAll();
													}
												}}
											>
												Unlink
											</button>
										{/if}
									{:else}
										<span class="iconify mdi--check size-6 text-green-500"></span>
									{/if}
								{:else}
									<button
										class="btn btn-primary btn-sm"
										onclick={() =>
											authClient
												.linkSocial({
													provider: provider.id
												})
												.then((result) => {
													if (result.error?.code) {
														return errorToast(authClient.$ERROR_CODES[result.error.code as keyof typeof authClient.$ERROR_CODES]);
													}
													invalidateAll();
												})}
									>
										Link
									</button>
								{/if}
							</span>
						</span>
					</li>
				{/each}
			</ul>
			<Passkeys />
			<div class="divider my-0 h-[9px]"></div>
			<ul class="menu menu-lg w-full px-0">
				<li>
					<a href="https://github.com/sillvva/ddal-svelte/issues" target="_blank" rel="noreferrer noopener">
						<span class="iconify mdi--bug size-6"></span>
						Report a bug
					</a>
				</li>
				<li>
					<a href="https://matt.dekok.dev" target="_blank" rel="noreferrer noopener">
						<span class="iconify mdi--information-outline size-6"></span>
						About the developer
					</a>
				</li>
				<li>
					<a href="http://paypal.me/Sillvva" target="_blank" rel="noreferrer noopener">
						<span class="iconify mdi--gift size-6"></span>
						Contribute
					</a>
				</li>
			</ul>
			<div class="flex-1"></div>

			<div class="flex flex-col gap-2">
				<div class="px-2 text-xs text-gray-500 dark:text-gray-400">
					User ID:<br />{global.user.id}
				</div>
				<div class="px-2 text-xs text-gray-500 dark:text-gray-400">
					Logged in {global.session?.createdAt.toLocaleString()}
				</div>
			</div>
		{/if}
	</aside>
	<div
		class="bg-base-300/50 fixed inset-0 -z-10 opacity-0 backdrop-blur-sm transition-all data-[open=false]:hidden data-[open=true]:z-40 data-[open=true]:opacity-100"
		onkeydown={() => (open = false)}
		onclick={() => (open = false)}
		role="none"
		data-open={open}
	></div>
{/if}

<style>
	aside :global {
		.menu-title {
			padding: 0;
		}

		.menu li > * {
			padding-left: 0.5rem;
			padding-right: 0rem;
		}

		.menu li > button {
			padding-left: 0.5rem;
			padding-right: 0.5rem;
			justify-content: start;
			font-weight: normal;
		}

		.menu li > :not(button, a):hover {
			cursor: default;
		}
	}
</style>
