<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { page } from "$app/state";
	import { errorToast, successToast } from "$lib/factories.svelte";
	import { getGlobal } from "$lib/stores.svelte";
	import { hotkey } from "$lib/util";
	import type {
		DeleteWebAuthnInput,
		DeleteWebAuthnResponse,
		RenameWebAuthnInput,
		RenameWebAuthnResponse
	} from "$src/routes/(api)/webAuthn/+server";
	import { signIn } from "@auth/sveltekit/webauthn";
	import { tick } from "svelte";
	import { scale } from "svelte/transition";
	import Control from "./forms/Control.svelte";

	const authenticators = $derived(page.data.user?.authenticators || []);
	const global = getGlobal();
	$effect(() => {
		global.app.settings.autoWebAuthn = authenticators.length > 0;
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
		const response = await fetch("/webAuthn", {
			method: "POST",
			body: JSON.stringify({ name, id } satisfies RenameWebAuthnInput)
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
				body: JSON.stringify({ id } satisfies DeleteWebAuthnInput)
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
	<li class="menu-title *:px-2">
		<span class="font-bold">Passkeys</span>
	</li>
	{#each authenticators as authenticator}
		<li class="flex-row gap-2">
			<button
				class="group btn btn-ghost hover:bg-base-200 flex flex-1 gap-2 text-left"
				onclick={() => initRename(authenticator.credentialID, authenticator.name)}
				aria-label="Rename Passkey"
			>
				<span class="iconify material-symbols--passkey group-hover:mdi--pencil size-6"></span>
				<span class="ellipsis-nowrap flex-1">{authenticator.name}</span>
			</button>
			<button
				class="btn btn-ghost text-error hover:bg-error hover:text-base-content"
				onclick={(e) => {
					e.stopPropagation();
					deleteWebAuthn(authenticator.credentialID);
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
				signIn("webauthn", { action: "register", redirect: false })
					.then((resp) => {
						if (resp?.ok) initRename();
						else errorToast("Failed to register passkey");
					})
					.catch(console.error)}
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
