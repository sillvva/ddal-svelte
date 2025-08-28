<script lang="ts" module>
	export const pageHead = {
		title: "Users"
	};
</script>

<script lang="ts">
	import { goto, invalidateAll } from "$app/navigation";
	import { page } from "$app/state";
	import { authClient } from "$lib/auth.js";
	import Search from "$lib/components/Search.svelte";
	import { BLANK_CHARACTER } from "$lib/constants.js";
	import { errorToast, successToast } from "$lib/factories.svelte.js";
	import AdminAPI from "$lib/remote/admin";
	import { JSONSearchParser } from "@sillvva/search/json";

	let search = $state(page.url.searchParams.get("s")?.trim() ?? "");

	const users = $derived(await AdminAPI.queries.getUsers());
	const parser = $derived(
		new JSONSearchParser(users, {
			defaultKey: "name",
			validKeys: ["id", "name", "email", "role", "banned", "characters"]
		})
	);

	const results = $derived(search.trim() ? parser.filter(search) : users);
</script>

<div class="mb-4 flex flex-wrap items-center justify-between gap-2 max-sm:justify-end">
	<div class="flex w-full gap-2 sm:max-w-md md:max-w-md">
		<Search bind:value={search} placeholder="Search by name, email, role, etc." />
	</div>
	<span class="badge bg-base-300 text-base-content badge-lg">
		{#if results.length < (users.length ?? 0)}
			Showing {results.length} of
		{/if}
		{users.length} users
	</span>
</div>

{#if results.length}
	<div class="overflow-x-auto rounded-lg">
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
							<div class="text-base-content/60 max-w-60 text-sm not-hover:truncate max-md:max-w-40">
								{user.email}
							</div>
							<div class="text-base-content/60 text-sm sm:hidden">
								Characters: {user.characters}
							</div>
						</td>
						<td class="text-center max-sm:hidden">{user.role.toLocaleUpperCase()}</td>
						<td class="text-center max-sm:hidden">{user.characters}</td>
						<td class="max-xs:hidden">
							<div class="flex justify-end gap-2">
								<button
									class="btn btn-sm btn-primary tooltip tooltip-left"
									aria-label="Impersonate {user.name}"
									data-tip="Impersonate {user.name}"
									disabled={user.role === "admin" || user.banned}
									onclick={async () => {
										if (user.role === "admin" || user.banned) return;
										const { data } = await authClient.admin.impersonateUser({
											userId: user.id
										});
										if (data) {
											await invalidateAll();
											goto("/characters");
										}
									}}
								>
									<span class="iconify mdi--account-switch"></span>
								</button>
								{#if !user.banned}
									<button
										class="btn btn-sm btn-error tooltip tooltip-left"
										aria-label="Ban {user.name}"
										data-tip="Ban {user.name}"
										disabled={user.role === "admin"}
										onclick={async () => {
											if (user.role === "admin") return;
											const reason = prompt("Reason for ban");
											if (!reason?.trim()) return errorToast("Reason is required");
											const { data } = await authClient.admin.banUser({
												userId: user.id,
												banReason: reason
											});
											if (data) {
												successToast(`${user.name} has been banned`);
												await invalidateAll();
											}
										}}
									>
										<span class="iconify mdi--ban"></span>
									</button>
								{:else}
									<button
										class="btn btn-sm btn-success tooltip tooltip-left"
										aria-label="Unban {user.name}"
										data-tip="Unban {user.name}"
										disabled={user.role === "admin"}
										onclick={async () => {
											if (user.role === "admin") return;
											if (!confirm(`Are you sure you want to unban ${user.name}?`)) return;
											const { data } = await authClient.admin.unbanUser({
												userId: user.id
											});
											if (data) {
												successToast(`${user.name} has been unbanned`);
												await invalidateAll();
											}
										}}
									>
										<span class="iconify mdi--check"></span>
									</button>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<div class="bg-base-200 flex h-40 flex-col items-center justify-center rounded-lg">
		<div class="text-base-content/60 text-lg">No users found</div>
	</div>
{/if}
