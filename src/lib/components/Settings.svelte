<script lang="ts">
	import { goto, invalidateAll } from "$app/navigation";
	import { page } from "$app/state";
	import { authClient, setDefaultUserImage, switchAccount } from "$lib/auth";
	import { BLANK_CHARACTER, PROVIDERS, type ProviderId } from "$lib/constants";
	import { errorToast } from "$lib/factories.svelte";
	import { isDefined } from "@sillvva/utils";
	import { twMerge } from "tailwind-merge";
	import Passkeys from "./Passkeys.svelte";
	import ThemeSwitcher from "./ThemeSwitcher.svelte";

	let open = $state(false);

	const { user, session } = $derived(page.data);
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

	let userAccounts = $state<{ providerId: ProviderId; name: string; email: string; image: string }[]>([]);
	let currentAccount = $derived<{ providerId: ProviderId; name: string; email: string; image: string } | undefined>(
		userAccounts.find((a) => a.name === user?.name && a.email === user?.email && a.image === user?.image) || undefined
	);
	$effect(() => {
		if (!userAccounts.length && open) {
			Promise.all(
				user.accounts.map(({ accountId, providerId }) =>
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
				)
			).then((result) => {
				userAccounts = result.filter(isDefined);
			});
		}
	});
</script>

{#if user}
	<div class="hidden items-center print:flex">
		{user.name}
	</div>
	<div class="avatar flex h-full min-w-fit items-center">
		<button
			class="ring-primary ring-offset-base-100 relative h-9 w-9 cursor-pointer overflow-hidden rounded-full ring-3 ring-offset-2 lg:h-11 lg:w-11"
			tabindex="0"
			onclick={() => (open = true)}
		>
			<img
				src={user.image || ""}
				alt={user.name}
				class="rounded-full object-cover object-center"
				onerror={(e) => {
					const img = e.currentTarget as HTMLImageElement;
					img.onerror = null;
					img.src = BLANK_CHARACTER;
					setDefaultUserImage(user.id);
				}}
			/>
		</button>
	</div>

	<aside
		id="settings"
		class="bg-base-100 fixed inset-y-0 -right-80 z-50 flex w-80 flex-col overflow-y-auto px-4 py-4 transition-all data-[open=true]:right-0"
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
				{#if session.impersonatedBy}
					<button
						class="btn btn-sm btn-primary tooltip"
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
						class="btn tooltip p-3"
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
										{#if !userAccounts.length}
											<span class="iconify mdi--loading size-5 animate-spin"></span>
										{:else}
											{@const account = userAccounts.find((a) => a.providerId === provider.id)}
											{#if currentAccount?.providerId !== provider.id && account}
												<button
													class="btn btn-sm btn-ghost tooltip"
													aria-label="Switch account"
													data-tip="Use this account"
													onclick={() => {
														switchAccount(user.id, account).then(() => {
															invalidateAll();
														});
													}}
												>
													<span class="iconify mdi--accounts-switch size-5"></span>
												</button>
												<button
													class="btn btn-error btn-sm font-semibold"
													onclick={() => {
														if (confirm("Are you sure you want to unlink this account?")) {
															authClient.unlinkAccount({ providerId: provider.id }).then((result) => {
																if (result.error?.code) {
																	return errorToast(
																		authClient.$ERROR_CODES[result.error.code as keyof typeof authClient.$ERROR_CODES]
																	);
																}
																invalidateAll();
															});
														}
													}}
												>
													Unlink
												</button>
											{/if}
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
						</label>
					</li>
				{/each}
			</ul>
			<Passkeys />
			<div class="divider my-0"></div>
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
				<div class="px-4 text-xs text-gray-500 dark:text-gray-400">
					User ID:<br />{user.id}
				</div>
				<div class="px-4 text-xs text-gray-500 dark:text-gray-400">
					Logged in {session.createdAt.toLocaleString()}
				</div>
			</div>
		{/if}
	</aside>
	<div
		class="bg-base-300/50 fixed inset-0 -z-10 opacity-0 transition-all data-[open=false]:hidden data-[open=true]:z-40 data-[open=true]:opacity-100"
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
