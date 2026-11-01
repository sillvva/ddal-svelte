<script lang="ts">
	import { page } from "$app/state";
	import Head from "#lib/components/head.svelte";
	import Search from "#lib/components/search.svelte";
	import { BLANK_CHARACTER } from "#lib/constants.js";
	import { errorToast, successToast } from "#lib/factories.svelte.js";
	import * as API from "#lib/remote/index.js";
	import { JSONSearchParser } from "@sillvva/search/json";
	import { toJSObjectNotation } from "@sillvva/utils";

	const searchKey = "s";
	const search = $derived(page.url.searchParams.get(searchKey) ?? page.state.search?.[searchKey] ?? "");

	const users = $derived(await API.admin.queries.getUsers());
	const parser = $derived(
		new JSONSearchParser(users, {
			defaultKey: "name",
			validKeys: ["id", "name", "email", "role", "banned", "characters"]
		})
	);

	const results = $derived(search.trim() ? parser.filter(search) : users);
</script>

<Head title="Users" />

<section class="flex flex-wrap items-center justify-between gap-2 max-sm:justify-end">
	<div class="flex w-full gap-2 sm:max-w-md md:max-w-md">
		<Search name={searchKey} placeholder="Search by name, email, role, etc." />
	</div>
	<span class="badge bg-base-300 badge-lg text-base-content">
		{#if results.length < (users.length ?? 0)}
			Showing {results.length} of
		{/if}
		{users.length} users
	</span>
</section>

{#if results.length}
	<section class="overflow-x-auto rounded-lg">
		<table class="linked-table table w-full bg-base-200 leading-5 max-sm:border-separate max-sm:border-spacing-y-2">
			<thead class="max-sm:hidden">
				<tr class="bg-base-300 text-base-content/70">
					<td></td>
					<td>Name</td>
					<td class="text-center max-sm:hidden">Role</td>
					<td class="text-center max-sm:hidden">Characters</td>
					<td class="w-0 max-xs:hidden"></td>
				</tr>
			</thead>
			<tbody>
				{#each results as user (user.id)}
					<tr data-banned={user.banned} class="data-[banned=true]:bg-error/10">
						<td class="pr-0 align-top transition-colors sm:pr-2">
							<div class="avatar">
								<div class="mask size-12 bg-primary mask-squircle">
									{#if user.image}
										<img
											src={user.image}
											width={48}
											height={48}
											class="size-full object-cover object-top duration-150 ease-in-out group-hover/row:scale-125 motion-safe:transition-transform"
											alt={user.name}
											loading="lazy"
											onerror={(e) => {
												const img = e.currentTarget as HTMLImageElement;
												img.onerror = null;
												img.src = BLANK_CHARACTER;
											}}
										/>
									{:else}
										<span class="iconify size-12 mdi--account"></span>
									{/if}
								</div>
							</div>
						</td>
						<td>
							{user.name}
							<div class="max-w-60 text-xs text-base-content/60 not-hover:truncate max-md:max-w-40">
								{user.email}
							</div>
							{#if user.banned}
								<div class="max-w-60 text-xs text-base-content/60 not-hover:truncate max-md:max-w-40">
									Banned: {user.banReason}
								</div>
							{:else}
								<div class="text-xs text-base-content/60 sm:hidden">
									Characters: {user.characters}
								</div>
							{/if}
						</td>
						<td class="text-center max-sm:hidden">{user.role.toLocaleUpperCase()}</td>
						<td class="text-center max-sm:hidden">{user.characters}</td>
						<td class="max-xs:hidden">
							<div class="flex justify-end gap-2">
								{const impersonateForm = $derived(API.admin.forms.impersonateUser.for(user.id))}
								<form
									{...impersonateForm.enhance(async ({ submit }) => {
										await submit();

										const issues = impersonateForm.fields.issues();
										if (issues?.length) {
											issues.forEach((issue) => errorToast(issue.message));
										}
									})}
									class="sm:tooltip sm:tooltip-left"
									data-tip="Impersonate {user.name}"
								>
									<input {...impersonateForm.fields.userId.as("hidden", user.id)} />
									<button
										type="submit"
										class="btn btn-primary btn-sm"
										aria-label="Impersonate {user.name}"
										disabled={user.role === "admin" || user.banned}
									>
										<span class="iconify mdi--account-switch"></span>
									</button>
								</form>
								{#if !user.banned}
									{const banForm = $derived(API.admin.forms.banUser.for(user.id))}
									<form
										onsubmit={(e) => {
											e.preventDefault();
											const banReason = prompt("Reason for ban");
											if (!banReason?.trim()) return errorToast("Reason is required");
											banForm.fields.banReason.set(banReason);
											e.currentTarget.requestSubmit();
										}}
										{...banForm.enhance(async ({ submit }) => {
											await submit().updates(
												API.admin.queries
													.getUsers()
													.withOverride((users) =>
														users.map((u) =>
															u.id === user.id ? { ...u, banned: true, banReason: banForm.fields.banReason.value() ?? null } : u
														)
													)
											);

											const issues = banForm.fields.allIssues();
											if (issues?.length) {
												issues.forEach((issue) => errorToast(`${toJSObjectNotation(issue.path) || "Error"}: ${issue.message}`));
											} else {
												successToast(`${user.name} has been banned`);
											}
										})}
										class="sm:tooltip sm:tooltip-left"
										data-tip="Ban {user.name}"
									>
										<input {...banForm.fields.userId.as("hidden", user.id)} />
										<input {...banForm.fields.banReason.as("text")} hidden />
										<button type="submit" class="btn btn-error btn-sm" aria-label="Ban {user.name}">
											<span class="iconify mdi--ban"></span>
										</button>
									</form>
								{:else}
									{const unbanForm = $derived(API.admin.forms.unbanUser.for(user.id))}
									<form
										{...unbanForm.enhance(async ({ submit }) => {
											if (!confirm(`Are you sure you want to unban ${user.name}?`)) return;

											await submit().updates(
												API.admin.queries
													.getUsers()
													.withOverride((users) =>
														users.map((u) => (u.id === user.id ? { ...u, banned: false, banReason: null } : u))
													)
											);

											const issues = unbanForm.fields.allIssues();
											if (issues?.length) {
												issues.forEach((issue) => errorToast(`${toJSObjectNotation(issue.path) || "Error"}: ${issue.message}`));
											} else {
												successToast(`${user.name} has been unbanned`);
											}
										})}
										class="sm:tooltip sm:tooltip-left"
										data-tip="Unban {user.name}"
									>
										<input {...unbanForm.fields.userId.as("hidden", user.id)} />
										<button type="submit" class="btn btn-sm btn-success" aria-label="Unban {user.name}">
											<span class="iconify mdi--check"></span>
										</button>
									</form>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{:else}
	<section class="flex h-40 flex-col items-center justify-center rounded-lg bg-base-200">
		<div class="text-lg text-base-content/60">No users found</div>
	</section>
{/if}
