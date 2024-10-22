<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { page } from "$app/stores";
	import { errorToast, successToast } from "$lib/factories";
	import { getApp } from "$lib/stores";
	import type { DeleteWebAuthnResponse, RenameWebAuthnResponse } from "$src/routes/(api)/webAuthn/+server";
	import { signIn } from "@auth/sveltekit/webauthn";
	import { hotkey } from "@svelteuidev/composables";
	import { tick } from "svelte";
	import { scale } from "svelte/transition";
	import Control from "./forms/Control.svelte";

	const app = getApp();

	const authenticators = $derived($page.data.user?.authenticators || []);
	$effect(() => {
		if (authenticators.length == 0) $app.settings.autoWebAuthn = false;
	});

	let renaming = $state(false);
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

	async function renameWebAuthn(isDefault = false) {
		if (isDefault && defaultName) {
			renaming = false;
			return;
		}

		const id = renameId;
		const name = isDefault ? "" : renameName;
		const response = await fetch("/webAuthn", {
			method: "POST",
			body: JSON.stringify({ name, id })
		});

		const value = (await response.json()) as RenameWebAuthnResponse;

		if (value.success) {
			if (defaultName) {
				if (defaultName === value.name) successToast(`Passkey "${value.name}" saved`);
				else successToast(`Passkey "${defaultName}" renamed to "${value.name}"`);
			} else {
				successToast(`Passkey "${value.name}" created`);
			}
			invalidateAll();
			renaming = false;
		} else {
			if (value.throw) {
				errorToast(value.error);
				renaming = false;
			} else initRename(id, name, value.error);
		}
	}

	async function deleteWebAuthn(id: string) {
		const auth = authenticators.find((a) => a.credentialID === id);
		if (!auth) return;
		if (confirm(`Are you sure you want to delete "${auth.name}"?`)) {
			const response = await fetch("/webAuthn", {
				method: "DELETE",
				body: JSON.stringify({ id })
			});

			const value = (await response.json()) as DeleteWebAuthnResponse;

			if (value.success) {
				successToast(`Passkey "${auth.name}" deleted`);
				invalidateAll();
			} else {
				errorToast(value.error);
			}
		}
	}
</script>

<ul class="menu menu-lg w-full px-0">
	<li class="menu-title [&>*]:px-2">
		<span class="font-bold">Passkeys</span>
	</li>
	{#each authenticators as authenticator}
		<li class="flex-row gap-2">
			<button
				class="group btn btn-ghost flex flex-1 gap-2 text-left hover:bg-base-200"
				onclick={() => initRename(authenticator.credentialID, authenticator.name)}
				aria-label="Rename Passkey"
			>
				<span class="iconify size-6 material-symbols--passkey group-hover:mdi--pencil"></span>
				<span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{authenticator.name}</span>
			</button>
			<button
				class="btn btn-ghost text-error hover:bg-error hover:text-base-content"
				onclick={(e) => {
					e.stopPropagation();
					deleteWebAuthn(authenticator.credentialID);
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
				signIn("webauthn", { action: "register", redirect: false })
					.then((resp) => {
						if (resp?.ok) initRename();
						else errorToast("Failed to register passkey");
					})
					.catch(console.error)}
		>
			<span class="iconify size-6 mdi--plus"></span>
			<span>Add Passkey</span>
		</button>
	</li>
	{#if authenticators.length}
		<li class="pt-2">
			<label class="flex gap-2 hover:bg-transparent">
				<span class="iconify size-6 mdi--auto-fix"></span>
				<span class="flex-1 text-base">Auto Passkey Login</span>
				<input type="checkbox" class="toggle" bind:checked={$app.settings.autoWebAuthn} />
			</label>
		</li>
		<li class="flex-row gap-2">
			<div class="flex gap-2 pt-0 hover:bg-transparent">
				<span class="inline-block size-6"></span>
				<span class="flex-1 text-sm text-gray-500">Enable this to automatically be prompted to login with a passkey</span>
			</div>
		</li>
	{/if}
</ul>

<dialog
	class="modal !bg-base-300/75"
	open={renaming}
	aria-labelledby="modal-title"
	aria-describedby="modal-content"
	use:hotkey={[
		[
			"Escape",
			() => {
				if (renaming) renameWebAuthn(true);
			}
		]
	]}
>
	{#if renaming}
		<div
			class="modal-box relative cursor-default bg-base-100 drop-shadow-lg"
			transition:scale={{ duration: 250, opacity: 0.75, start: 0.85 }}
		>
			<button
				class="btn btn-circle btn-ghost btn-sm absolute right-2 top-2"
				onclick={() => renameWebAuthn(true)}
				aria-label="Close"
			>
				<span class="iconify mdi--close"></span>
			</button>
			<h3 id="modal-title" class="mb-4 cursor-text text-lg font-bold text-black dark:text-white">Rename Passkey</h3>
			<form
				onsubmit={(e) => {
					e.preventDefault();
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
						class="input input-bordered w-full focus:border-primary"
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
					<button class="btn btn-primary">Save</button>
				</div>
			</form>
		</div>

		<button class="modal-backdrop" onclick={() => renameWebAuthn(true)}>✕</button>
	{/if}
</dialog>
