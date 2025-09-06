<script lang="ts">
	import { goto, invalidateAll } from "$app/navigation";
	import { authClient } from "$lib/auth";
	import { BLANK_CHARACTER, PROVIDERS, type ProviderId } from "$lib/constants";
	import { errorToast } from "$lib/factories.svelte";
	import AppAPI from "$lib/remote/app";
	import AuthAPI from "$lib/remote/auth";
	import { getGlobal } from "$lib/stores.svelte";
	import { parseEffectResult } from "$lib/util";
	import { isDefined } from "@sillvva/utils";
	import { isTupleOfAtLeast } from "effect/Predicate";
	import { twMerge } from "tailwind-merge";
	import Passkeys from "./Passkeys.svelte";
	import ThemeSwitcher from "./ThemeSwitcher.svelte";

	interface Props {
		open: boolean;
	}

	export type UserAccount = { providerId: ProviderId; name: string; email: string; image: string };

	let { open = $bindable(false) }: Props = $props();

	const global = getGlobal();

	const request = $derived(await AppAPI.queries.request());
	const user = $derived(request.user);
	const session = $derived(request.session);

	const authProviders = $derived(
		PROVIDERS.map((p) => ({
			...p,
			account: user?.accounts.find((a) => a.providerId === p.id)
		}))
	);
	const initials = $derived(
		user?.name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.slice(0, 2) || ""
	);

	let userAccounts = $state<UserAccount[]>([]);
	const currentAccount = $derived(userAccounts.find((a) => a.providerId === global.app.settings.provider));

	$effect(() => {
		if (!userAccounts.length && open) {
			Promise.allSettled(
				user?.accounts.map(({ accountId, providerId }) =>
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
					userAccounts.find((a) => a.name === user?.name && a.email === user?.email) ||
					(isTupleOfAtLeast(userAccounts, 1) ? userAccounts[0] : undefined);

				if (account) {
					if (!global.app.settings.provider) {
						global.app.settings.provider = account.providerId;
					}
					if (
						account.name !== user?.name ||
						account.email !== user?.email ||
						(account.image !== user?.image && !account.image.includes(BLANK_CHARACTER))
					) {
						const result = await AuthAPI.actions.updateUser(account);
						const parsed = await parseEffectResult(result);
						if (parsed) await AppAPI.queries.request().refresh();
					}
				}
			});
		}
	});
</script>

{#if user}
	<aside
		id="settings"
		class="bg-base-100 fixed inset-y-0 -right-80 z-50 flex w-80 flex-col overflow-y-auto px-4 pb-4 shadow-lg shadow-black/50 transition-all data-[open=true]:right-0 print:hidden"
		data-open={open}
	>
		{#if user}
			<div class="flex items-center gap-4 py-4 pl-2">
				<div
					class="avatar ring-primary group/avatar bg-primary ring-offset-base-100 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-3 ring-offset-2"
				>
					{#if user.image}
						<img
							src={user.image}
							alt={user.name}
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
					<div class="ellipsis-nowrap font-medium">{user.name}</div>
					<div class="ellipsis-nowrap text-xs font-medium text-gray-500 dark:text-gray-400">
						{user.email}
					</div>
				</div>
				{#if session?.impersonatedBy}
					<button
						class="btn btn-sm btn-primary tooltip tooltip-left"
						data-tip="Stop impersonating"
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
				{:else}
					<button
						class="btn tooltip tooltip-left p-3"
						data-tip="Sign out"
						aria-label="Sign out"
						onclick={() =>
							authClient.signOut({
								fetchOptions: {
									onSuccess: () => {
										invalidateAll();
									}
								}
							})}
					>
						<i class="iconify mdi--logout h-5 w-5"></i>
					</button>
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
							<span class={twMerge("size=6 iconify-color", provider.iconify)}></span>
							<span class="flex-1">{provider.name}</span>
							<span class="join flex items-center">
								{#if provider.account}
									{#if user.accounts.length > 1}
										{#if !userAccounts.length}
											<span class="iconify mdi--loading size-5 animate-spin"></span>
										{:else}
											{@const account = userAccounts.find((a) => a.providerId === provider.id)}
											{#if account}
												{#if currentAccount?.providerId !== provider.id || account.name !== user.name || account.email !== user.email || account.image !== user.image}
													<button
														class="btn btn-sm tooltip join-item bg-base-300"
														aria-label="Switch account"
														data-tip="Use this account"
														disabled={!!AuthAPI.actions.updateUser.pending}
														onclick={async () => {
															const result = await AuthAPI.actions.updateUser(account);
															const parsed = await parseEffectResult(result);
															if (parsed) {
																global.app.settings.provider = account.providerId;
																await AppAPI.queries.request().refresh();
															}
														}}
													>
														<span class="iconify mdi--accounts-switch size-5"></span>
													</button>
												{/if}
											{/if}
											<button
												class="btn btn-error btn-sm join-item font-semibold"
												disabled={currentAccount?.providerId === provider.id || !!AuthAPI.actions.updateUser.pending}
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
					User ID:<br />{user.id}
				</div>
				<div class="px-2 text-xs text-gray-500 dark:text-gray-400">
					Logged in {session?.createdAt.toLocaleString()}
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
			padding-left: 0.5rem;
			padding-right: 0rem;
		}

		:global(.menu li > button) {
			padding-left: 0.5rem;
			padding-right: 0.5rem;
			justify-content: start;
			font-weight: normal;
		}

		:global(.menu li > :not(button, a):hover) {
			background-color: transparent !important;
			cursor: default;
		}
	}
</style>
