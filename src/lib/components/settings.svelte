<script lang="ts">
	import { authClient } from "#lib/auth.js";
	import { BLANK_CHARACTER, PROVIDERS } from "#lib/constants.js";
	import { errorToast } from "#lib/factories.svelte.js";
	import { getAccounts } from "#lib/remote/auth/queries.remote.js";
	import * as API from "#lib/remote/index.js";
	import { getGlobal } from "#lib/stores.svelte.js";
	import { hotkey, parseEffectResult } from "#lib/util.js";
	import { getLocalTimeZone } from "@internationalized/date";
	import { isTupleOfAtLeast } from "@sillvva/utils";
	import { onMount, tick } from "svelte";
	import Passkeys from "./passkeys.svelte";
	import ThemeSwitcher from "./theme-switcher.svelte";

	interface Props {
		open: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	const { user, session } = $derived(await API.app.queries.request());
	const global = getGlobal();

	let deleteConfirmOpen = $state(false);
	let confirmation = $state("");
	let deleteAccountForm = $state<HTMLFormElement | null>(null);

	const userIdSegment = $derived(user?.id.split("-").at(-1) ?? "");
	const confirmationMatches = $derived(
		userIdSegment.length > 0 && confirmation.trim().toLowerCase() === userIdSegment.toLowerCase()
	);

	function bindDeleteAccountForm(node: HTMLFormElement) {
		deleteAccountForm = node;
		return () => {
			deleteAccountForm = null;
		};
	}

	function focusInput(node: HTMLInputElement) {
		node.focus();
	}

	function openDeleteConfirm() {
		confirmation = "";
		deleteConfirmOpen = true;
	}

	function closeDeleteConfirm() {
		deleteConfirmOpen = false;
		confirmation = "";
	}

	const userAccounts = $derived(await getAccounts());
	const currentAccount = $derived(userAccounts.find((a) => a.providerId === global.app.settings.provider));
	const authProviders = $derived(
		PROVIDERS.map((p) => ({
			...p,
			account: user?.accounts.find((a) => a.providerId === p.id)
		}))
	);

	onMount(() => {
		const handleOpenSettings = () => void (open = true);
		document.addEventListener("open-settings", handleOpenSettings);
		return () => {
			document.removeEventListener("open-settings", handleOpenSettings);
		};
	});

	onMount(() => {
		global.app.settings.timezone = getLocalTimeZone();

		const account =
			userAccounts.find((a) => a.providerId === global.app.settings.provider) ||
			userAccounts.find((a) => a.name === user?.name && a.email === user?.email) ||
			(isTupleOfAtLeast(userAccounts, 1) ? userAccounts[0] : undefined);

		if (account) {
			if (!global.app.settings.provider) {
				global.app.settings.provider = account.providerId;
			}

			// User information has changed
			if (
				account.name !== user?.name ||
				account.email !== user?.email ||
				(account.image !== user?.image && !account.image.includes(BLANK_CHARACTER))
			) {
				API.auth.actions.updateUser(account).then(async (result) => {
					const parsed = await parseEffectResult(result);
					if (parsed) await API.app.queries.request().refresh();
				});
			}
		}
	});
</script>

{#if user}
	<aside
		id="settings"
		class="fixed inset-y-0 -right-80 z-50 flex w-80 flex-col overflow-y-auto bg-base-100 px-4 pb-4 transition-all data-[open=true]:right-0 data-[open=true]:shadow-lg data-[open=true]:shadow-black/50 print:hidden"
		data-open={open}
	>
		<div class="flex items-center gap-4 py-4 pl-2">
			<div
				class="group/avatar avatar flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary ring-3 ring-primary ring-offset-2 ring-offset-base-100"
			>
				{const nameParts = $derived(user.name.split(" "))}
				{const initials = $derived(
					nameParts
						.map((n) => (n[0] || "") + (nameParts.length === 1 ? n[1] : ""))
						.join("")
						.slice(0, 2) || ""
				)}
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
					<span class="text-xl font-bold text-primary-content uppercase">{initials}</span>
				{/if}
			</div>
			<div class="flex-1">
				<div class="ellipsis-nowrap font-medium">{user.name}</div>
				<div class="ellipsis-nowrap text-xs font-medium text-gray-500 dark:text-gray-400">
					{user.email}
				</div>
			</div>
			{#if session?.impersonatedBy}
				<form {...API.admin.forms.stopImpersonating} class="tooltip tooltip-left" data-tip="Stop impersonating">
					<button type="submit" class="btn p-3 btn-primary" aria-label="Stop impersonating" onclick={() => (open = false)}>
						<span class="iconify size-5 mdi--account-switch"></span>
					</button>
				</form>
			{:else}
				<form {...API.auth.forms.signOut} class="tooltip tooltip-left" data-tip="Sign out">
					<button type="submit" class="btn p-3" aria-label="Sign out">
						<span class="iconify size-5 mdi--logout"></span>
					</button>
				</form>
			{/if}
		</div>
		<div class="divider my-0 h-2.25"></div>
		<ul class="menu w-full gap-2 menu-lg px-0">
			<li>
				<div class="flex items-center gap-2 py-0 hover:bg-transparent">
					<span class="flex-1">Theme</span>
					<ThemeSwitcher />
				</div>
			</li>
			<li>
				<div class="flex items-center gap-2 py-0 hover:bg-transparent">
					<span class="flex-1">Layout</span>
					<select class="select-bordered select flex-1 select-sm max-sm:text-base" bind:value={global.app.settings.maxwidth}>
						<option value="container">Container</option>
						<option value="full">Full Width</option>
					</select>
				</div>
			</li>
		</ul>
		<div class="divider my-0 h-2.25"></div>
		<div class="collapse max-lg:collapse-arrow lg:collapse-open">
			<input type="checkbox" class="lg:hidden" />
			<div class="collapse-title px-2 font-semibold lg:hidden">Account Settings</div>
			<div class="collapse-content px-0 pb-0">
				<ul class="menu w-full menu-lg px-0 [&_li>*]:px-2">
					<li class="menu-title">
						<span class="font-bold">Linked Accounts</span>
					</li>
					{#each authProviders as provider (provider.id)}
						{const account = $derived(userAccounts.find((a) => a.providerId === provider.id))}
						{#if account}
							{const accountId = $derived(account.id)}
							<li>
								<span class="flex gap-2 hover:bg-transparent">
									<span class={["size=6 iconify-color", provider.iconify]}></span>
									<span class="flex-1">{provider.name}</span>
									<span class="join flex items-center">
										{#if provider.account}
											{#if user.accounts.length > 1}
												{#if !userAccounts.length}
													<span class="iconify size-5 animate-spin mdi--loading"></span>
												{:else}
													{#if currentAccount?.providerId !== provider.id || account.name !== user.name || account.email !== user.email || account.image !== user.image}
														<div class="tooltip" data-tip="Use this account">
															<button
																class="btn join-item bg-base-300 btn-sm"
																aria-label="Switch account"
																disabled={!!API.auth.actions.updateUser.pending}
																onclick={async () => {
																	const result = await API.auth.actions.updateUser(account);
																	const parsed = await parseEffectResult(result);
																	if (parsed) global.app.settings.provider = provider.id;
																	await tick();
																	await API.app.queries.request().refresh();
																}}
															>
																<span class="iconify size-5 mdi--accounts-switch"></span>
															</button>
														</div>
													{/if}
													<button
														class="btn join-item font-semibold btn-error btn-sm"
														disabled={currentAccount?.providerId === provider.id || !!API.auth.actions.updateUser.pending}
														onclick={async () => {
															if (currentAccount?.providerId === provider.id || !!API.auth.actions.updateUser.pending) return;
															if (!confirm("Are you sure you want to unlink this account?")) return;
															const result = await authClient.unlinkAccount({ accountId });
															if (result.error) {
																return errorToast(
																	result.error.message ||
																		authClient.$ERROR_CODES[result.error.code as keyof typeof authClient.$ERROR_CODES].message
																);
															}
															await API.app.queries.request().refresh();
														}}
													>
														Unlink
													</button>
												{/if}
											{:else}
												<span class="iconify size-6 text-green-500 mdi--check"></span>
											{/if}
										{:else}
											<button
												class="btn btn-primary btn-sm"
												onclick={() =>
													authClient
														.linkSocial({
															provider: provider.id
														})
														.then(async (result) => {
															if (result.error?.code) {
																return errorToast(
																	authClient.$ERROR_CODES[result.error.code as keyof typeof authClient.$ERROR_CODES].message
																);
															}
															await API.app.queries.request().refresh();
														})}
											>
												Link
											</button>
										{/if}
									</span>
								</span>
							</li>
						{/if}
					{/each}
				</ul>
				<Passkeys />
				{#if !session?.impersonatedBy}
					<div class="collapse-arrow collapse my-2 border border-base-300 bg-base-100">
						<input type="checkbox" />
						<div class="collapse-title font-semibold text-error">Danger Zone</div>
						<div class="collapse-content text-sm">
							<form
								{@attach bindDeleteAccountForm}
								{...API.auth.forms.deleteAccount.enhance(async ({ submit }) => {
									const result = await submit();
									if (!result) errorToast("Failed to delete account");
								})}
							>
								<button
									type="button"
									class="btn btn-block btn-error"
									disabled={!!API.auth.forms.deleteAccount.pending}
									onclick={openDeleteConfirm}
								>
									{#if API.auth.forms.deleteAccount.pending}
										<span class="iconify size-5 animate-spin mdi--loading"></span>
									{:else}
										<span class="iconify size-5 mdi--account-remove"></span>
									{/if}
									Delete account
								</button>
							</form>
						</div>
					</div>
				{/if}
			</div>
		</div>
		<div class="divider my-0 h-2.25"></div>
		<ul class="menu w-full menu-lg px-0">
			<li>
				<a href="https://github.com/sillvva/ddal-svelte" target="_blank" rel="noreferrer noopener">
					<span class="iconify size-6 mdi--github"></span>
					Github
				</a>
			</li>
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
				<a href="https://account.venmo.com/u/Matt-DeKok" target="_blank" rel="noreferrer noopener">
					<span class="iconify size-6 mdi--gift"></span>
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
	</aside>
	<div
		class="fixed inset-0 -z-10 bg-base-300/50 opacity-0 backdrop-blur-sm transition-all data-[open=false]:hidden data-[open=true]:z-40 data-[open=true]:opacity-100"
		onkeydown={() => (open = false)}
		onclick={() => (open = false)}
		role="none"
		data-open={open}
	></div>

	<dialog
		class="modal bg-base-300/75!"
		open={deleteConfirmOpen || undefined}
		aria-labelledby="delete-account-title"
		aria-describedby="delete-account-description"
		{@attach hotkey([
			[
				"Escape",
				() => {
					if (deleteConfirmOpen) closeDeleteConfirm();
				}
			]
		])}
	>
		{#if deleteConfirmOpen}
			<div class="relative modal-box cursor-default bg-base-100 drop-shadow-lg">
				<button
					type="button"
					class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm"
					onclick={closeDeleteConfirm}
					aria-label="Close"
				>
					<span class="iconify mdi--close"></span>
				</button>
				<form
					class="flex flex-col gap-3"
					onsubmit={(event) => {
						event.preventDefault();
						if (!confirmationMatches || API.auth.forms.deleteAccount.pending) return;
						deleteAccountForm?.requestSubmit();
					}}
				>
					<h3 id="delete-account-title" class="pr-8 text-lg font-bold text-base-content">Delete account</h3>
					<p id="delete-account-description" class="text-sm">
						This action cannot be undone. Enter the last segment of your user ID to confirm.
					</p>
					<p class="font-mono text-xs break-all text-base-content/70">
						{user.id.slice(0, -userIdSegment.length)}<span class="font-semibold text-error">{userIdSegment}</span>
					</p>
					<label class="flex flex-col gap-1">
						<span class="text-xs font-medium">User ID segment</span>
						<input
							class="input w-full font-mono max-sm:text-base"
							{@attach focusInput}
							bind:value={confirmation}
							autocomplete="off"
							autocapitalize="off"
							spellcheck="false"
							placeholder="Last segment"
						/>
					</label>
					<div class="modal-action">
						<button type="button" class="btn" onclick={closeDeleteConfirm}>Cancel</button>
						<button type="submit" class="btn btn-error" disabled={!confirmationMatches || !!API.auth.forms.deleteAccount.pending}>
							{#if API.auth.forms.deleteAccount.pending}
								<span class="iconify size-5 animate-spin mdi--loading"></span>
							{/if}
							Delete account
						</button>
					</div>
				</form>
			</div>
			<button type="button" class="modal-backdrop" onclick={closeDeleteConfirm} aria-label="Close">✕</button>
		{/if}
	</dialog>
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
