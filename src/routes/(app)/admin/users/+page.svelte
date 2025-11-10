<script lang="ts">
	import { page } from "$app/state";
	import Head from "$lib/components/head.svelte";
	import Search from "$lib/components/search.svelte";
	import { BLANK_CHARACTER } from "$lib/constants.js";
	import { errorToast, successToast } from "$lib/factories.svelte.js";
	import * as API from "$lib/remote";
	import { banUser, impersonateUser, unbanUser } from "$lib/remote/admin/forms.remote";
	import { getIssuePath } from "$lib/util";
	import { JSONSearchParser } from "@sillvva/search/json";

	let search = $state(page.url.searchParams.get("s")?.trim() ?? "");

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
		<Search bind:value={search} placeholder="Search by name, email, role, etc." />
	</div>
	<span class="badge bg-base-300 text-base-content badge-lg">
		{#if results.length < (users.length ?? 0)}
			Showing {results.length} of
		{/if}
		{users.length} users
	</span>
</section>

{#if results.length}
	<section class="overflow-x-auto rounded-lg">
		<table class="linked-table bg-base-200 table w-full leading-5 max-sm:border-separate max-sm:border-spacing-y-2">
			<thead class="max-sm:hidden">
				<tr class="bg-base-300 text-base-content/70">
					<td></td>
					<td>Name</td>
					<td class="text-center max-sm:hidden">Role</td>
					<td class="text-center max-sm:hidden">Characters</td>
					<td class="max-xs:hidden w-0"></td>
				</tr>
			</thead>
			<tbody>
				{#each results as user (user.id)}
					{@const impersonateForm = impersonateUser.for(user.id)}
					{@const banForm = banUser.for(user.id)}
					{@const unbanForm = unbanUser.for(user.id)}
					<tr data-banned={user.banned} class="data-[banned=true]:bg-error/10">
						<td class="pr-0 align-top transition-colors sm:pr-2">
							<div class="avatar">
								<div class="mask mask-squircle bg-primary size-12">
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
										<span class="iconify mdi--account size-12"></span>
									{/if}
								</div>
							</div>
						</td>
						<td>
							{user.name}
							<div class="text-base-content/60 max-w-60 text-xs not-hover:truncate max-md:max-w-40">
								{user.email}
							</div>
							{#if user.banned}
								<div class="text-base-content/60 max-w-60 text-xs not-hover:truncate max-md:max-w-40">
									Banned: {user.banReason}
								</div>
							{:else}
								<div class="text-base-content/60 text-xs sm:hidden">
									Characters: {user.characters}
								</div>
							{/if}
						</td>
						<td class="text-center max-sm:hidden">{user.role.toLocaleUpperCase()}</td>
						<td class="text-center max-sm:hidden">{user.characters}</td>
						<td class="max-xs:hidden">
							<div class="flex justify-end gap-2">
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
										class="btn btn-sm btn-primary"
										aria-label="Impersonate {user.name}"
										disabled={user.role === "admin" || user.banned}
									>
										<span class="iconify mdi--account-switch"></span>
									</button>
								</form>
								{#if !user.banned}
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
															u.id === user.id ? { ...u, banned: true, banReason: banForm.fields.banReason.value() } : u
														)
													)
											);

											const issues = banForm.fields.allIssues();
											if (issues?.length) {
												issues.forEach((issue) => errorToast(`${getIssuePath(issue.path) || "Error"}: ${issue.message}`));
											} else {
												successToast(`${user.name} has been banned`);
											}
										})}
										class="sm:tooltip sm:tooltip-left"
										data-tip="Ban {user.name}"
									>
										<input {...banForm.fields.userId.as("hidden", user.id)} />
										<input {...banForm.fields.banReason.as("text")} hidden />
										<button type="submit" class="btn btn-sm btn-error" aria-label="Ban {user.name}">
											<span class="iconify mdi--ban"></span>
										</button>
									</form>
								{:else}
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
												issues.forEach((issue) => errorToast(`${getIssuePath(issue.path) || "Error"}: ${issue.message}`));
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
	<section class="bg-base-200 flex h-40 flex-col items-center justify-center rounded-lg">
		<div class="text-base-content/60 text-lg">No users found</div>
	</section>
{/if}
