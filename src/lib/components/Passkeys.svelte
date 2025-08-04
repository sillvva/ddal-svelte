<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { page } from "$app/state";
	import { authClient } from "$lib/auth";
	import { errorToast, successToast } from "$lib/factories.svelte";
	import { deletePasskey, renamePasskey } from "$lib/remote/auth.remote";
	import { getGlobal } from "$lib/stores.svelte";
	import { hotkey } from "$lib/util";
	import { tick } from "svelte";
	import { scale } from "svelte/transition";
	import Control from "./forms/Control.svelte";

	const passkeys = $derived(page.data.user?.passkeys || []);
	const global = getGlobal();

	$effect(() => {
		global.app.settings.autoWebAuthn = passkeys.length > 0;
	});

	$effect(() => {
		const emptyPasskey = passkeys.find((a) => !a.name);
		if (emptyPasskey) {
			initRename(emptyPasskey.id, emptyPasskey.name || "");
		}
	});

	let renaming = $state<boolean | "saving">(false);
	let defaultName = $state("");
	let renameId: string | undefined = $state();
	let renameName = $state("");
	let renameError = $state("");
	let renameRef: HTMLInputElement | undefined = $state();

	async function initRename(id?: string, currentName = "", error = "") {
		if (!error) defaultName = currentName;

		renameId = id;
		renameName = currentName;
		renameError = error;
		renaming = true;

		await tick();
		if (renameRef) renameRef.focus();
	}

	async function renameWebAuthn(useDefault = false) {
		if (renaming === "saving") return;
		if (useDefault && defaultName) {
			renaming = false;
			return;
		}
		renaming = "saving";

		const id = renameId;
		const name = useDefault ? "" : renameName;

		const result = await renamePasskey({ name, id });
		if (result.ok) {
			console.log(result);
			if (defaultName) {
				if (defaultName === result.data.name) successToast(`Passkey "${result.data.name}" saved`);
				else successToast(`Passkey "${defaultName}" renamed to "${result.data.name}"`);
			} else {
				successToast(`Passkey "${result.data.name}" created`);
			}
			invalidateAll();
			renaming = false;
		} else if (result.error.extra.retry) {
			initRename(id, name, result.error.message);
		} else {
			errorToast(result.error.message);
			renaming = false;
		}
	}

	async function deleteWebAuthn(id: string) {
		const auth = passkeys.find((a) => a.id === id);
		if (!auth) return;
		if (confirm(`Are you sure you want to delete "${auth.name}"?`)) {
			const result = await deletePasskey({ id });
			if (result.ok) {
				successToast(`Passkey "${auth.name}" deleted`);
				invalidateAll();
			} else {
				errorToast(result.error.message);
			}
		}
	}
</script>

<ul class="menu menu-lg w-full px-0">
	<li class="menu-title *:px-2">
		<span class="font-bold">Passkeys</span>
	</li>
	{#each passkeys as passkey}
		<li class="flex-row gap-2">
			<button
				class="group btn btn-ghost hover:bg-base-200 flex flex-1 gap-2 text-left"
				onclick={() => initRename(passkey.id, passkey.name || "")}
				aria-label="Rename Passkey"
			>
				<span class="iconify material-symbols--passkey group-hover:mdi--pencil size-6"></span>
				<span class="ellipsis-nowrap flex-1">
					{#if passkey.name}
						{passkey.name}
					{:else if renameId === passkey.id}
						Renaming...
					{:else}
						<span class="text-error">Unnamed</span>
					{/if}
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
							onSuccess: () => {
								invalidateAll();
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

<dialog
	class="modal bg-base-300/75!"
	open={!!renaming}
	aria-labelledby="modal-title"
	aria-describedby="modal-content"
	{@attach hotkey([
		[
			"Escape",
			() => {
				if (renaming === true) renameWebAuthn(true);
			}
		]
	])}
>
	{#if renaming}
		<div
			class="modal-box bg-base-100 relative cursor-default drop-shadow-lg"
			transition:scale={{ duration: 250, opacity: 0.75, start: 0.85 }}
		>
			<button
				class="btn btn-circle btn-ghost btn-sm absolute top-2 right-2"
				onclick={() => renameWebAuthn(true)}
				aria-label="Close"
				disabled={renaming === "saving"}
			>
				<span class="iconify mdi--close"></span>
			</button>
			<h3 id="modal-title" class="text-base-content mb-4 cursor-text text-lg font-bold">Rename Passkey</h3>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					if (renaming === "saving") return;
					renameWebAuthn();
				}}
			>
				<Control>
					<input
						type="text"
						id="passkeyName"
						placeholder="Passkey Name"
						bind:value={renameName}
						bind:this={renameRef}
						class="input focus:border-primary w-full"
						maxlength="20"
						required
					/>
					{#if renameError}
						<label for="passkeyName" class="label">
							<span class="label-text-alt text-error">{renameError}</span>
						</label>
					{/if}
				</Control>
				<div class="modal-action">
					<button class="btn btn-primary" disabled={renaming === "saving"}>
						{#if renaming === "saving"}
							<span class="loading"></span>
							Saving...
						{:else}
							Save
						{/if}
					</button>
				</div>
			</form>
		</div>

		<button class="modal-backdrop" onclick={() => renameWebAuthn(true)}>✕</button>
	{/if}
</dialog>
