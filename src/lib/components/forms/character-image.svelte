<script lang="ts" module>
	import type { CharacterImageUploadId } from "#lib/schemas.js";

	const unsavedUploadKey = "ddal:unsaved-character-image";
	// Shared by every edit form in this document. A reload creates a new module, so a stored id is then abandoned.
	let pendingUploadId = "";

	function rememberUnsaved(uploadId: CharacterImageUploadId) {
		pendingUploadId = uploadId;
		sessionStorage.setItem(unsavedUploadKey, uploadId);
	}

	function releaseUnsaved(keepalive: boolean) {
		const uploadId = pendingUploadId || sessionStorage.getItem(unsavedUploadKey) || "";
		if (!uploadId) return;
		pendingUploadId = "";
		sessionStorage.removeItem(unsavedUploadKey);
		const body = JSON.stringify({ uploadId });
		if (keepalive && navigator.sendBeacon("/character-image/release", new Blob([body], { type: "application/json" }))) {
			return;
		}
		void fetch("/character-image/release", {
			method: "POST",
			credentials: "same-origin",
			headers: { "content-type": "application/json" },
			body,
			keepalive
		}).catch(() => {
			if (!keepalive) {
				pendingUploadId = uploadId;
				sessionStorage.setItem(unsavedUploadKey, uploadId);
			}
		});
	}

	if (typeof window !== "undefined") {
		const flag = "__ddalReleaseUnsavedCharacterImage";
		const target = window as Window & { [flag]?: boolean };
		if (!target[flag]) {
			target[flag] = true;
			window.addEventListener("pagehide", (event) => {
				if (event.persisted) return;
				releaseUnsaved(true);
			});
		}
	}
</script>

<script lang="ts">
	import { BLANK_CHARACTER } from "#lib/constants.js";
	import { CHARACTER_IMAGE_LIMITS, formatBytes } from "#lib/images/limits.js";
	import { resizeCharacterImage } from "#lib/images/resize.js";
	import * as API from "#lib/remote/index.js";
	import type { CharacterId } from "#lib/schemas.js";
	import { onNavigate } from "$app/navigation";
	import { R2_PUBLIC_URL } from "$app/env/public";
	import type { RemoteFormField } from "$app/server";
	import { onMount, untrack } from "svelte";
	import Input from "./input.svelte";

	type ImageSource = "url" | "upload";

	interface Props {
		field: RemoteFormField<string>;
		characterId: CharacterId;
		/** Saved portrait, used to pick the initial option before the field updates. */
		savedUrl?: string;
		onpending?: (pending: boolean) => void;
	}

	let { field, characterId, savedUrl = "", onpending }: Props = $props();

	const sources = [
		{ id: "url", label: "Image URL" },
		{ id: "upload", label: "Upload" }
	] as const satisfies { id: ImageSource; label: string }[];

	function storedPrefix() {
		const base = new URL(R2_PUBLIC_URL);
		return `${base.origin}${base.pathname.replace(/\/$/, "")}/`;
	}

	function isStoredImage(url: string) {
		return url.startsWith(storedPrefix());
	}

	function sourceFor(url: string): ImageSource {
		if (!url || url === BLANK_CHARACTER) return "url";
		return isStoredImage(url) ? "upload" : "url";
	}

	const startingUrl = untrack(() => field.value() || savedUrl);
	let source = $state<ImageSource>(sourceFor(startingUrl));
	let urlDraft = $state(sourceFor(startingUrl) === "url" ? startingUrl : "");
	let uploadedUrl = $state(sourceFor(startingUrl) === "upload" ? startingUrl : "");
	let uploading = $state(false);
	let failure = $state("");
	let status = $state("");
	let localPreview = $state("");

	onNavigate((navigation) => {
		if (navigation.shallow) return;
		releaseUnsaved(false);
	});

	onMount(() => {
		const stored = sessionStorage.getItem(unsavedUploadKey) ?? "";
		if (stored && stored !== pendingUploadId) {
			pendingUploadId = stored;
			releaseUnsaved(false);
		}
	});

	const preview = $derived(localPreview || (source === "url" ? field.value() : "") || BLANK_CHARACTER);
	const imgurWarning = $derived(
		source === "url" && field.value()?.includes("imgur")
			? "Images from imgur may not appear when sharing links due to rate limiting"
			: undefined
	);
	const help = `JPEG, PNG, WebP, or GIF up to ${formatBytes(CHARACTER_IMAGE_LIMITS.maxOriginalBytes)}.`;

	function setPending(pending: boolean) {
		uploading = pending;
		onpending?.(pending);
	}

	function choose(next: ImageSource) {
		if (uploading || next === source) return;
		if (source === "url") urlDraft = field.value() ?? "";
		const current = field.value() ?? "";
		if (source === "upload" && isStoredImage(current)) uploadedUrl = current;

		source = next;
		failure = "";
		status = "";
		if (next === "url") field.set(urlDraft);
		else field.set(uploadedUrl);
	}

	async function onFile(event: Event) {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement)) return;
		const file = input.files?.[0];
		input.value = "";
		if (!file || uploading) return;

		failure = "";
		status = "Resizing image…";
		setPending(true);
		let previewUrl = "";

		try {
			const resized = await resizeCharacterImage(file);
			previewUrl = URL.createObjectURL(resized.blob);
			localPreview = previewUrl;

			status = "Uploading image…";
			const prepared = await API.characters.actions.prepareCharacterImage({
				characterId,
				contentType: resized.contentType,
				bytes: resized.blob.size
			});
			if (!prepared.ok) {
				failure = prepared.error.message;
				return;
			}

			rememberUnsaved(prepared.data.uploadId);
			const uploaded = await fetch(prepared.data.uploadUrl, {
				method: "PUT",
				body: resized.blob,
				headers: { "content-type": prepared.data.contentType }
			});
			if (!uploaded.ok) {
				failure = uploaded.status === 403 ? "Storage rejected the upload. Choose the image again." : "The upload did not finish.";
				await releaseUnsaved(false);
				return;
			}

			const completed = await API.characters.actions.completeCharacterImage({ uploadId: prepared.data.uploadId });
			if (!completed.ok) {
				failure = completed.error.message;
				await releaseUnsaved(false);
				return;
			}

			uploadedUrl = completed.data.imageUrl;
			field.set(completed.data.imageUrl);
			source = "url";
			status = "";
		} catch (error) {
			failure =
				error instanceof TypeError
					? "The browser could not reach storage. The bucket needs a CORS rule that allows PUT from this site."
					: error instanceof Error
						? error.message
						: "Could not upload the image.";
		} finally {
			if (localPreview === previewUrl) localPreview = "";
			if (previewUrl) URL.revokeObjectURL(previewUrl);
			status = failure ? "" : status;
			setPending(false);
		}
	}
</script>

<div class="mt-2 flex flex-1 flex-col gap-3 sm:flex-row sm:items-start">
	<img
		src={preview}
		alt="Character portrait"
		class="size-32 shrink-0 rounded-lg border border-base-content/20 object-cover object-top"
	/>
	<div class="flex min-w-0 flex-1 flex-col gap-2">
		<div class="join" role="radiogroup" aria-label="Portrait">
			{#each sources as option (option.id)}
				<button
					type="button"
					class={["btn join-item btn-sm", source === option.id && "btn-primary"]}
					aria-pressed={source === option.id}
					disabled={uploading}
					onclick={() => choose(option.id)}
				>
					{option.label}
				</button>
			{/each}
		</div>
		{#if source === "url"}
			<Input {field} type="url" label="Portrait" placeholder="https://" warning={imgurWarning} />
		{:else}
			<div class="mt-2">
				<label class={["btn btn-outline btn-sm", uploading && "pointer-events-none opacity-50"]}>
					{uploading ? "Uploading image…" : "Choose image"}
					<input
						class="hidden"
						type="file"
						accept="image/jpeg,image/png,image/webp,image/gif"
						disabled={uploading}
						onchange={onFile}
					/>
				</label>
			</div>
			{#if uploading && status}
				<p class="flex items-center gap-2 text-pretty text-neutral-500">
					<span class="loading loading-xs"></span>
					{status}
				</p>
			{:else if failure}
				<p class="rounded-lg bg-error px-2 py-1 text-pretty text-error-content">{failure}</p>
			{:else}
				<p class="text-pretty text-neutral-500">{help}</p>
			{/if}
			<Input {field} type="hidden" />
		{/if}
	</div>
</div>
