<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { page } from "$app/state";
	import { authClient } from "$lib/auth";
	import { errorToast, successToast } from "$lib/factories.svelte";
	import type { PasskeyId } from "$lib/schemas";
	import { getGlobal } from "$lib/stores.svelte";

	const passkeys = $derived(page.data.user?.passkeys || []);
	const global = getGlobal();

	$effect(() => {
		global.app.settings.autoWebAuthn = passkeys.length > 0;
	});

	async function initRename(id: PasskeyId, currentName = "", error = "") {
		const name =
			prompt("Enter a name for this passkey" + (error ? `\n\n${error}` : ""), currentName.trim()) || id.split("-").at(-1) || "";

		if (!name.trim()) {
			initRename(id, name, "Passkey name cannot be empty");
			return;
		}

		if (passkeys.find((a) => a.name === name)) {
			initRename(id, name, "Passkey name already exists");
			return;
		}

		await authClient.passkey.updatePasskey({
			id,
			name,
			fetchOptions: {
				onSuccess: () => {
					successToast(`Passkey "${name}" saved`);
					invalidateAll();
				},
				onError: ({ error }) => {
					initRename(id, name, error.message);
				}
			}
		});
	}

	async function deleteWebAuthn(id: PasskeyId) {
		const auth = passkeys.find((a) => a.id === id);
		if (!auth) return;
		if (confirm(`Are you sure you want to delete "${auth.name}"?`)) {
			await authClient.passkey.deletePasskey({
				id,
				fetchOptions: {
					onSuccess: () => {
						successToast(`Passkey "${auth.name}" deleted`);
						invalidateAll();
					},
					onError: ({ error }) => {
						errorToast(error.message);
					}
				}
			});
		}
	}
</script>

<ul class="menu menu-lg w-full px-0">
	<li class="menu-title *:px-2">
		<span class="font-bold">Passkeys</span>
	</li>
	{#each passkeys as passkey (passkey.id)}
		<li class="flex-row gap-2">
			<button
				class="group btn btn-ghost hover:bg-base-200 flex flex-1 gap-2 text-left"
				onclick={() => initRename(passkey.id, passkey.name || "")}
				aria-label="Rename Passkey"
			>
				<span class="iconify material-symbols--passkey group-hover:mdi--pencil size-6"></span>
				<span class="ellipsis-nowrap flex-1">
					{passkey.name}
				</span>
			</button>
			<button
				class="btn btn-ghost text-error hover:bg-error hover:text-base-content"
				onclick={(e) => {
					e.stopPropagation();
					deleteWebAuthn(passkey.id);
				}}
				aria-label="Delete Passkey"
			>
				<span class="iconify mdi--delete size-6"></span>
			</button>
		</li>
	{/each}
	<li>
		<button
			class="btn btn-ghost hover:bg-base-200"
			onclick={() =>
				authClient.passkey
					.addPasskey({
						fetchOptions: {
							onSuccess: ({ data }: { data: { id: PasskeyId; name: string | null } }) => {
								initRename(data.id, data.name || "");
							}
						}
					})
					.then((result) => {
						if (result?.error?.message) {
							errorToast(result.error.message);
						}
					})}
		>
			<span class="iconify mdi--plus size-6"></span>
			<span>Add Passkey</span>
		</button>
	</li>
</ul>
