<script lang="ts">
	import { goto, invalidateAll } from "$app/navigation";
	import { authClient } from "$lib/auth.js";
	import Search from "$lib/components/Search.svelte";
	import { errorToast, successToast } from "$lib/factories.svelte.js";
	import { JSONSearchParser } from "@sillvva/search/json";

	let { data } = $props();

	let search = $state(data.search);

	const parser = $derived(
		new JSONSearchParser(data.users, {
			defaultKey: "name",
			validKeys: ["id", "name", "email", "role", "banned", "characters"]
		})
	);

	const results = $derived(search.trim() ? parser.filter(search) : data.users);
</script>

<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
	<div class="flex w-full gap-2 sm:max-w-md md:max-w-md">
		<Search bind:value={search} placeholder="Search by name, email, role, etc." />
	</div>
	<span class="badge badge-primary badge-lg">
		{#if results.length < data.users.length}
			Showing {results.length} of
		{/if}
		{data.users.length} users
	</span>
</div>
<table class="linked-table bg-base-200 table w-full leading-5 max-sm:border-separate max-sm:border-spacing-y-2">
	<thead class="max-sm:hidden">
		<tr class="bg-base-300 text-base-content/70">
			{#if !data.mobile}
				<td></td>
			{/if}
			<td>Name</td>
			<td>Email</td>
			<td class="text-center">Role</td>
			<td class="text-center">Characters</td>
			<td class="text-center">Banned</td>
			{#if !data.mobile}
				<td class="w-0"></td>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each results as user}
			<tr data-banned={user.isBanned} class="data-[banned=true]:bg-error/10">
				{#if !data.mobile}
					<td class="pr-0 align-top transition-colors max-sm:hidden sm:pr-2">
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
									/>
								{:else}
									<span class="iconify mdi--account size-12"></span>
								{/if}
							</div>
						</div>
					</td>
				{/if}
				<td>{user.name}</td>
				<td>{user.email}</td>
				<td class="text-center">{user.role.toLocaleUpperCase()}</td>
				<td class="text-center">{user.characters}</td>
				<td class="text-center">{user.banned}</td>
				{#if !data.mobile}
					<td>
						<div class="flex justify-end gap-2">
							<button
								class="btn btn-sm btn-primary tooltip"
								aria-label="Impersonate {user.name}"
								data-tip="Impersonate {user.name}"
								disabled={user.role === "admin" || user.isBanned}
								onclick={async () => {
									if (user.role === "admin" || user.isBanned) return;
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
							{#if !user.isBanned}
								<button
									class="btn btn-sm btn-error tooltip"
									aria-label="Ban {user.name}"
									data-tip="Ban {user.name}"
									disabled={user.role === "admin" || user.isBanned}
									onclick={async () => {
										if (user.role === "admin" || user.isBanned) return;
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
									class="btn btn-sm btn-success tooltip"
									aria-label="Unban {user.name}"
									data-tip="Unban {user.name}"
									disabled={user.role === "admin" || !user.isBanned}
									onclick={async () => {
										if (user.role === "admin" || !user.isBanned) return;
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
				{/if}
			</tr>
		{/each}
	</tbody>
</table>
