<script lang="ts">
	import { authClient } from "#lib/auth.js";
	import { errorToast, successToast } from "#lib/factories.svelte.js";
	import * as API from "#lib/remote/index.js";
	import type { PasskeyId } from "#lib/schemas.js";
	import { getGlobal } from "#lib/stores.svelte.js";

	const { user } = $derived(await API.app.queries.request());
	const global = getGlobal();
	const passkeys = $derived(user?.passkeys || []);

	$effect(() => {
		if (global.app.settings.autoWebAuthn !== passkeys.length > 0) {
			global.app.settings.autoWebAuthn = passkeys.length > 0;
		}
	});

	async function initRename(id: PasskeyId, currentName = "", error = "") {
		const passkey = passkeys.find((a) => a.id === id);
		const fallback = currentName.trim() || id.split("-").at(-1);

		const name = prompt("Enter a name for this passkey" + (error ? `\n\n${error}` : ""), currentName.trim()) || fallback || "";

		if (name.trim() === passkey?.name) return;
		if ((name.trim() === fallback || name.trim() === "") && passkey?.name) return;

		if (passkeys.find((a) => a.name === name)) {
			initRename(id, name, "Passkey name already exists");
			return;
		}

		await authClient.passkey.updatePasskey({
			id,
			name,
			fetchOptions: {
				onSuccess: () => {
					successToast(`${name} saved`);
					API.app.queries.request().refresh();
				},
				onError: ({ error }) => {
					initRename(id, name, error.message);
				}
			}
		});
	}

	async function deleteWebAuthn(id: PasskeyId) {
		const passkey = passkeys.find((a) => a.id === id);
		if (!passkey) return;
		if (confirm(`Are you sure you want to delete ${passkey.name}?`)) {
			await authClient.passkey.deletePasskey({
				id,
				fetchOptions: {
					onSuccess: () => {
						successToast(`${passkey.name} deleted`);
						API.app.queries.request().refresh();
					},
					onError: ({ error }) => {
						errorToast(error.message);
					}
				}
			});
		}
	}
</script>

<ul class="menu w-full menu-lg px-0">
	<li class="menu-title *:px-2">
		<span class="font-bold">Passkeys</span>
	</li>
	{#each passkeys as passkey (passkey.id)}
		<li class="flex-row gap-2">
			<button
				class="group btn flex flex-1 gap-2 btn-ghost text-left hover:bg-base-200"
				onclick={() => initRename(passkey.id, passkey.name || "")}
				aria-label="Rename Passkey"
			>
				<span class="iconify size-6 material-symbols--passkey group-hover:mdi--pencil"></span>
				<span class="flex-1 ellipsis-nowrap">
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
				<span class="iconify size-6 mdi--delete"></span>
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
			<span class="iconify size-6 mdi--plus"></span>
			<span>Add Passkey</span>
		</button>
	</li>
</ul>
