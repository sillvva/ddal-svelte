<script lang="ts">
	import { goto, invalidateAll } from "$app/navigation";
	import { authClient } from "$lib/auth.js";
	import { errorToast, successToast } from "$lib/factories.svelte.js";

	let { data } = $props();
</script>

<table class="linked-table bg-base-200 table w-full leading-5 max-sm:border-separate max-sm:border-spacing-y-2">
	<thead class="max-sm:hidden">
		<tr class="bg-base-300 text-base-content/70">
			{#if !data.mobile}
				<td></td>
			{/if}
			<td>Name</td>
			<td>Role</td>
			<td class="text-center">Banned</td>
			{#if !data.mobile}
				<td class="w-0"></td>
			{/if}
		</tr>
	</thead>
	<tbody>
		{#each data.users as user}
			<tr>
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
				<td>{user.role.toLocaleUpperCase()}</td>
				<td class="text-center">{user.banned ? "Yes" : "No"}</td>
				{#if !data.mobile}
					<td>
						<div class="flex justify-end gap-2">
							<button
								class="btn btn-sm btn-primary tooltip"
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
									class="btn btn-sm btn-error tooltip"
									aria-label="Ban {user.name}"
									data-tip="Ban {user.name}"
									disabled={user.role === "admin" || user.banned}
									onclick={async () => {
										if (user.role === "admin" || user.banned) return;
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
									disabled={user.role === "admin" || !user.banned}
									onclick={async () => {
										if (user.role === "admin" || !user.banned) return;
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
