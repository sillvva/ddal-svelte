<script lang="ts">
	import { matchesDeleteConfirmation, deleteConfirmationSegment } from "#lib/admin-user.js";
	import { hotkey } from "#lib/attachments.js";
	import Head from "#lib/components/head.svelte";
	import Link from "#lib/components/link.svelte";
	import NavMenu from "#lib/components/nav-menu.svelte";
	import { BLANK_CHARACTER, PROVIDERS } from "#lib/constants.js";
	import { errorToast, successToast } from "#lib/factories.svelte.js";
	import { imageStorageView } from "#lib/images/limits.js";
	import * as API from "#lib/remote/index.js";
	import { getGlobal } from "#lib/stores.svelte.js";
	import { formatDate, parseEffectResult } from "#lib/util.js";
	import { toJSObjectNotation } from "@sillvva/utils";
	import { SvelteSet } from "svelte/reactivity";

	const { params } = $props();

	const global = getGlobal();
	const timezone = $derived(global.app.settings.timezone);

	const user = $derived(await API.admin.queries.getUserDetail(params.id));
	const isAdmin = $derived(user.role === "admin");
	const usage = $derived(
		user.storage.quotaBytes === null ? null : imageStorageView({ ...user.storage, quotaBytes: user.storage.quotaBytes })
	);

	const deleteForm = API.admin.forms.deleteUser;
	const deleteSegment = $derived(deleteConfirmationSegment(user.id));
	const deleteConfirmation = $derived(deleteForm.fields.confirmation.value() ?? "");
	const deleteConfirmed = $derived(matchesDeleteConfirmation(user.id, deleteConfirmation));
	const deletePending = $derived(!!deleteForm.pending);
	let deleteOpen = $state(false);

	const revoking = new SvelteSet<string>();
	let revokingAll = $state(false);

	function providerName(providerId: string) {
		return PROVIDERS.find((provider) => provider.id === providerId)?.name ?? providerId;
	}

	/** Example: "Level 1 Human Paladin". */
	function characterSummary(character: { totalLevel: number; race: string; class: string }) {
		return [`Level ${character.totalLevel}`, character.race, character.class].filter(Boolean).join(" ");
	}

	function openDelete() {
		deleteForm.fields.confirmation.set("");
		deleteOpen = true;
	}

	function closeDelete() {
		if (deletePending) return;
		deleteOpen = false;
		deleteForm.fields.confirmation.set("");
	}

	function focusInput(node: HTMLInputElement) {
		node.focus();
	}

	async function revokeSession(sessionId: string) {
		if (revoking.has(sessionId) || !confirm("Revoke this session? The user will be signed out on that device.")) return;
		revoking.add(sessionId);
		try {
			const result = await API.admin.actions.revokeUserSession({ userId: user.id, sessionId });
			if (await parseEffectResult(result)) successToast("Session revoked");
		} finally {
			revoking.delete(sessionId);
		}
	}

	async function revokeAllSessions() {
		if (revokingAll || !confirm(`Revoke all sessions for ${user.name}? They will be signed out everywhere.`)) return;
		revokingAll = true;
		try {
			const result = await API.admin.actions.revokeAllUserSessions({ userId: user.id });
			if (await parseEffectResult(result)) successToast("All sessions revoked");
		} finally {
			revokingAll = false;
		}
	}
</script>

<Head title={user.name} />

<NavMenu
	crumbs={[
		{ title: "Users", href: "admin/users" },
		{ title: user.name, href: "/(app)/admin/users/[id=UserId]", params: { id: user.id } }
	]}
/>

<section class="flex flex-wrap items-center gap-4 rounded-lg bg-base-200 p-4">
	<div class="avatar">
		<div class="mask size-16 bg-primary mask-squircle">
			{#if user.image}
				<img
					src={user.image}
					width={64}
					height={64}
					class="size-full object-cover object-top"
					alt={user.name}
					onerror={(e) => {
						const img = e.currentTarget as HTMLImageElement;
						img.onerror = null;
						img.src = BLANK_CHARACTER;
					}}
				/>
			{:else}
				<span class="iconify size-16 mdi--account"></span>
			{/if}
		</div>
	</div>
	<div class="min-w-0 flex-1">
		<h1 class="flex flex-wrap items-center gap-2 text-2xl font-bold">
			{user.name}
			<span class="badge badge-outline">{user.role.toLocaleUpperCase()}</span>
			{#if user.banned}
				<span class="badge badge-error">Banned</span>
			{/if}
		</h1>
		<p class="truncate text-sm text-base-content/70">{user.email}</p>
		<p class="font-mono text-xs break-all text-base-content/50">{user.id}</p>
		{#if user.banned}
			<p class="text-xs text-error">Banned: {user.banReason ?? "No reason given"}</p>
		{/if}
	</div>
</section>

<section class="mt-4 grid gap-4 md:grid-cols-2">
	<div class="rounded-lg bg-base-200 p-4">
		<h2 class="mb-2 font-semibold">Overview</h2>
		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
			<dt class="text-base-content/60">Onboarded</dt>
			<dd data-testid="onboarded">{user.onboarded ? "Yes" : "No"}</dd>
			<dt class="text-base-content/60">Created</dt>
			<dd>{formatDate(user.createdAt, timezone)}</dd>
			<dt class="text-base-content/60">Last session</dt>
			<dd data-testid="last-session">{user.lastSessionAt ? formatDate(user.lastSessionAt, timezone) : "Never"}</dd>
			<dt class="text-base-content/60">Characters</dt>
			<dd>{user.characters.length}</dd>
			<dt class="text-base-content/60">Image storage</dt>
			<dd data-testid="storage-use">
				{#if usage}
					{usage.usedLabel} / {usage.quotaLabel} ({usage.percent}%)
					<span class="block text-xs text-base-content/60">Characters: {usage.portraitsLabel} · Notes: {usage.notesLabel}</span>
				{:else}
					Unlimited
				{/if}
			</dd>
		</dl>
	</div>

	<div class="rounded-lg bg-base-200 p-4">
		<h2 class="mb-2 font-semibold">Sign-in methods</h2>
		<h3 class="text-xs font-semibold text-base-content/60 uppercase">Accounts</h3>
		<ul class="mb-3 text-sm" aria-label="Accounts">
			{#each user.accounts as account (account.id)}
				<li class="flex justify-between gap-2">
					<span>{providerName(account.providerId)}</span>
					<span class="text-base-content/60">Linked {formatDate(account.createdAt, timezone)}</span>
				</li>
			{:else}
				<li class="text-base-content/60">No linked providers</li>
			{/each}
		</ul>
		<h3 class="text-xs font-semibold text-base-content/60 uppercase">Passkeys</h3>
		<ul class="text-sm" aria-label="Passkeys">
			{#each user.passkeys as passkey (passkey.id)}
				<li class="flex justify-between gap-2">
					<span>{passkey.name || "Passkey"}</span>
					<span class="text-base-content/60">Added {formatDate(passkey.createdAt, timezone)}</span>
				</li>
			{:else}
				<li class="text-base-content/60">No passkeys</li>
			{/each}
		</ul>
	</div>
</section>

<section class="mt-4 rounded-lg bg-base-200 p-4">
	<h2 class="mb-2 font-semibold">Characters ({user.characters.length})</h2>
	{#if user.characters.length}
		<ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Characters">
			{#each user.characters as character (character.id)}
				<li class="linked-card flex items-center gap-3 rounded-box bg-base-100 p-2 shadow-sm">
					<div class="avatar shrink-0">
						<div class="mask size-10 bg-primary mask-squircle">
							<img
								src={character.imageUrl || BLANK_CHARACTER}
								width={40}
								height={40}
								class="size-full object-cover object-top"
								alt=""
								loading="lazy"
								onerror={(e) => {
									const img = e.currentTarget as HTMLImageElement;
									img.onerror = null;
									img.src = BLANK_CHARACTER;
								}}
							/>
						</div>
					</div>
					<div class="min-w-0">
						<Link
							href="/(app)/characters/[characterId=CharacterId]"
							params={{ characterId: character.id }}
							class="card-link block truncate text-sm font-bold text-base-content hover:underline"
						>
							{character.name}
						</Link>
						<p class="truncate text-xs text-base-content/70">{characterSummary(character)}</p>
					</div>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-base-content/60">No characters</p>
	{/if}
</section>

<section class="mt-4 rounded-lg bg-base-200 p-4">
	<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
		<h2 class="font-semibold">Active sessions ({user.sessions.length})</h2>
		<button
			type="button"
			class="btn btn-error btn-sm"
			disabled={isAdmin || !user.sessions.length || revokingAll}
			onclick={revokeAllSessions}
		>
			{#if revokingAll}
				<span class="iconify animate-spin mdi--loading"></span>
			{/if}
			Revoke all sessions
		</button>
	</div>
	{#if isAdmin}
		<p class="mb-2 text-xs text-base-content/60">Sessions of admin accounts cannot be revoked here.</p>
	{/if}
	{#if user.sessions.length}
		<div class="overflow-x-auto">
			<table class="table table-sm">
				<thead>
					<tr class="text-base-content/70">
						<th>IP address</th>
						<th>User agent</th>
						<th>Expires</th>
						<th>Impersonated by</th>
						<th class="w-0"></th>
					</tr>
				</thead>
				<tbody>
					{#each user.sessions as session (session.id)}
						<tr data-session-id={session.id}>
							<td class="font-mono text-xs">{session.ipAddress ?? "Unknown"}</td>
							<td class="max-w-64 truncate text-xs" title={session.userAgent ?? undefined}>{session.userAgent ?? "Unknown"}</td>
							<td class="text-xs whitespace-nowrap">{formatDate(session.expiresAt, timezone)}</td>
							<td class="text-xs">
								{#if session.impersonatedBy}
									<span title={session.impersonatedBy}>{session.impersonatedByName ?? session.impersonatedBy}</span>
								{:else}
									<span class="text-base-content/60">-</span>
								{/if}
							</td>
							<td>
								<button
									type="button"
									class="btn btn-square btn-error btn-xs"
									aria-label="Revoke session"
									disabled={isAdmin || revoking.has(session.id)}
									onclick={() => revokeSession(session.id)}
								>
									<span class="iconify mdi--logout"></span>
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="text-sm text-base-content/60">No active sessions</p>
	{/if}
</section>

<section class="mt-4 rounded-lg border border-error/40 bg-base-200 p-4">
	<h2 class="mb-1 font-semibold text-error">Danger zone</h2>
	<p class="mb-3 text-sm text-base-content/70">
		Deleting an account removes the user, their characters, logs and stored images. This cannot be undone.
	</p>
	<button type="button" class="btn btn-error" disabled={isAdmin} onclick={openDelete}>
		<span class="iconify size-5 mdi--account-remove"></span>
		Delete user
	</button>
	{#if isAdmin}
		<p class="mt-2 text-xs text-base-content/60">Admin accounts cannot be deleted.</p>
	{/if}
</section>

{#if deleteOpen}
	<dialog
		class="modal bg-base-300/25!"
		open
		aria-labelledby="delete-user-title"
		aria-describedby="delete-user-description"
		{@attach hotkey([["Escape", closeDelete]])}
	>
		<div class="relative modal-box cursor-default bg-base-100 drop-shadow-lg">
			<button
				type="button"
				class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm"
				onclick={closeDelete}
				aria-label="Close"
			>
				<span class="iconify mdi--close"></span>
			</button>
			<form
				class="flex flex-col gap-3"
				{...deleteForm.enhance(async ({ submit }) => {
					if (!deleteConfirmed) return;
					await submit();

					const issues = deleteForm.fields.allIssues();
					issues?.forEach((issue) => errorToast(`${toJSObjectNotation(issue.path) || "Error"}: ${issue.message}`));
				})}
			>
				<input {...deleteForm.fields.userId.as("hidden", user.id)} />
				<h3 id="delete-user-title" class="pr-8 text-lg font-bold text-base-content">Delete {user.name}</h3>
				<p id="delete-user-description" class="text-sm">
					This permanently deletes the account and queues its stored images for removal. Enter the last segment of the user ID to
					confirm.
				</p>
				<p class="font-mono text-xs break-all text-base-content/70">
					{user.id.slice(0, -deleteSegment.length)}<span class="font-semibold text-error">{deleteSegment}</span>
				</p>
				<label class="flex flex-col gap-1">
					<span class="text-xs font-medium">User ID segment</span>
					<input
						{...deleteForm.fields.confirmation.as("text")}
						class="input w-full font-mono max-sm:text-base"
						{@attach focusInput}
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
						placeholder="Last segment"
					/>
				</label>
				<div class="modal-action">
					<button type="button" class="btn" onclick={closeDelete} disabled={deletePending}>Cancel</button>
					<button type="submit" class="btn btn-error" disabled={!deleteConfirmed || deletePending}>
						{#if deletePending}
							<span class="iconify size-5 animate-spin mdi--loading"></span>
						{/if}
						Delete user
					</button>
				</div>
			</form>
		</div>
		<button type="button" class="modal-backdrop" onclick={closeDelete} aria-label="Close">✕</button>
	</dialog>
{/if}
