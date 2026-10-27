<script lang="ts">
	import { BLANK_CHARACTER } from "#lib/constants.js";
	import { AVATAR_IMAGE_LIMITS, CHARACTER_IMAGE_LIMITS, formatBytes } from "#lib/images/limits.js";
	import {
		isPermanentAvatarImageKey,
		isPermanentCharacterImageKey,
		isTemporaryAvatarImageKey,
		isTemporaryCharacterImageKey,
		keyFromPublicUrl
	} from "#lib/images/object-key.js";
	import { resizeAvatarImage, resizeCharacterImage } from "#lib/images/resize.js";
	import * as API from "#lib/remote/index.js";
	import type { CharacterId, CharacterImageUploadId } from "#lib/schemas.js";
	import { R2_PUBLIC_URL } from "$app/env/public";
	import type { RemoteFormField } from "$app/server";
	import { untrack } from "svelte";
	import Input from "./input.svelte";

	type ImageSource = "url" | "upload";

	interface CharacterProps {
		purpose: "character";
		field: RemoteFormField<string>;
		characterId: CharacterId;
		/** Saved portrait, used to pick the initial option before the field updates. */
		savedUrl?: string;
		onpending?: (pending: boolean) => void;
	}

	interface AvatarProps {
		purpose: "avatar";
		/** Saved profile picture. An empty value shows the placeholder until an upload finishes. */
		savedUrl?: string;
		onpending?: (pending: boolean) => void;
		/** Verified `tmp/` object. The parent promotes it when the user saves. */
		onstaged?: (staged: { uploadId: CharacterImageUploadId; imageUrl: string }) => void;
	}

	type Props = CharacterProps | AvatarProps;

	let props: Props = $props();

	const sources = [
		{ id: "url", label: "Image URL" },
		{ id: "upload", label: "Upload" }
	] as const satisfies { id: ImageSource; label: string }[];

	function fieldValue() {
		return props.purpose === "character" ? (props.field.value() ?? "") : "";
	}

	function setField(value: string) {
		if (props.purpose === "character") props.field.set(value);
	}

	function storedKey(url: string) {
		return keyFromPublicUrl(url, R2_PUBLIC_URL);
	}

	function isStoredImage(url: string) {
		const key = storedKey(url);
		if (!key) return false;
		if (props.purpose === "avatar") return isTemporaryAvatarImageKey(key) || isPermanentAvatarImageKey(key);
		// Staged uploads are public at img.dekok.app under tmp/ until save promotes them.
		return isTemporaryCharacterImageKey(key) || isPermanentCharacterImageKey(key);
	}

	function sourceFor(url: string): ImageSource {
		if (props.purpose === "avatar") return "upload";
		if (!url || url === BLANK_CHARACTER) return "url";
		const key = storedKey(url);
		// A saved portrait opens on Upload. A staged tmp/ URL is shown and submitted as a URL; save copies it.
		if (key && isPermanentCharacterImageKey(key)) return "upload";
		return "url";
	}

	const startingUrl = untrack(() =>
		props.purpose === "character" ? fieldValue() || props.savedUrl || "" : props.savedUrl || ""
	);
	const startingSource = sourceFor(startingUrl);
	let source = $state<ImageSource>(startingSource);
	let urlDraft = $state(startingSource === "url" ? startingUrl : "");
	let uploadedUrl = $state(isStoredImage(startingUrl) ? startingUrl : "");
	let uploading = $state(false);
	let failure = $state("");
	let status = $state("");
	let localPreview = $state("");
	let dragDepth = $state(0);

	const acceptingDrop = $derived(dragDepth > 0 && !uploading);
	const acceptedTypes = $derived<ReadonlySet<string>>(
		new Set(props.purpose === "character" ? CHARACTER_IMAGE_LIMITS.acceptedInputTypes : AVATAR_IMAGE_LIMITS.acceptedInputTypes)
	);
	const preview = $derived.by(() => {
		if (localPreview) return localPreview;
		if (props.purpose === "character") return props.field.value() || uploadedUrl || BLANK_CHARACTER;
		return uploadedUrl || props.savedUrl || BLANK_CHARACTER;
	});
	const imgurWarning = $derived(
		props.purpose === "character" && source === "url" && props.field.value()?.includes("imgur")
			? "Images from imgur may not appear when sharing links due to rate limiting"
			: undefined
	);
	const help = $derived(
		props.purpose === "character"
			? `JPEG, PNG, WebP, or GIF up to ${formatBytes(CHARACTER_IMAGE_LIMITS.maxOriginalBytes)}. Drop an image here or choose a file.`
			: `JPEG, PNG, WebP, or GIF up to ${formatBytes(AVATAR_IMAGE_LIMITS.maxOriginalBytes)}. The picture is cropped to a square. Drop an image here or choose a file.`
	);
	const statusId = $derived(props.purpose === "character" ? "character-image-status" : "avatar-image-status");
	const groupLabel = $derived(
		props.purpose === "character" ? "Character portrait. Drop an image to upload." : "Profile picture. Drop an image to upload."
	);
	const previewClass = $derived(
		props.purpose === "character"
			? "size-32 shrink-0 rounded-lg border border-base-content/20 object-cover object-top"
			: "size-32 shrink-0 rounded-full border border-base-content/20 object-cover object-center"
	);
	const alt = $derived(props.purpose === "character" ? "Character portrait" : "Profile picture");

	function setPending(pending: boolean) {
		uploading = pending;
		props.onpending?.(pending);
	}

	function remember(current: string) {
		if (source === "url") urlDraft = current;
		if (isStoredImage(current)) uploadedUrl = current;
	}

	function choose(next: ImageSource) {
		if (props.purpose !== "character" || uploading || next === source) return;
		remember(fieldValue());

		source = next;
		failure = "";
		status = "";
		if (next === "url") setField(urlDraft);
		else setField(uploadedUrl);
	}

	function showUpload() {
		if (props.purpose !== "character" || source === "upload") return;
		remember(fieldValue());
		source = "upload";
		setField(uploadedUrl);
	}

	/** Put a staged `tmp/` URL in the URL input, which is what character save submits. */
	function useImageUrl(imageUrl: string, uploadId: CharacterImageUploadId) {
		uploadedUrl = imageUrl;
		failure = "";
		status = "";
		if (props.purpose === "character") {
			urlDraft = imageUrl;
			source = "url";
			setField(imageUrl);
			return;
		}
		props.onstaged?.({ uploadId, imageUrl });
	}

	function fileFromDataTransfer(transfer: DataTransfer | null) {
		if (!transfer) return null;
		return [...transfer.files].find((file) => acceptedTypes.has(file.type)) ?? null;
	}

	function isFileDrag(transfer: DataTransfer | null) {
		return !!transfer && [...transfer.types].includes("Files");
	}

	function onDragEnter(event: DragEvent) {
		if (!isFileDrag(event.dataTransfer) || uploading) return;
		event.preventDefault();
		dragDepth += 1;
	}

	function onDragOver(event: DragEvent) {
		if (!isFileDrag(event.dataTransfer) || uploading) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
	}

	function onDragLeave(event: DragEvent) {
		if (dragDepth === 0) return;
		event.preventDefault();
		dragDepth = Math.max(0, dragDepth - 1);
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragDepth = 0;
		if (uploading) return;
		const file = fileFromDataTransfer(event.dataTransfer);
		if (!file) {
			failure = "Drop a JPEG, PNG, WebP, or GIF image.";
			showUpload();
			return;
		}
		void uploadFile(file);
	}

	async function onFile(event: Event) {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement)) return;
		const file = input.files?.[0];
		input.value = "";
		if (!file || uploading) return;
		await uploadFile(file);
	}

	async function uploadFile(file: File) {
		showUpload();
		failure = "";
		status = "Resizing image…";
		setPending(true);
		let previewUrl = "";

		try {
			const resized = props.purpose === "character" ? await resizeCharacterImage(file) : await resizeAvatarImage(file);
			previewUrl = URL.createObjectURL(resized.blob);
			localPreview = previewUrl;

			status = "Uploading image…";
			const prepared =
				props.purpose === "character"
					? await API.characters.actions.prepareCharacterImage({
							characterId: props.characterId,
							contentType: resized.contentType,
							bytes: resized.blob.size
						})
					: await API.images.actions.prepareAvatarImage({
							contentType: resized.contentType,
							bytes: resized.blob.size
						});
			if (!prepared.ok) {
				failure = prepared.error.message;
				return;
			}

			const uploaded = await fetch(prepared.data.uploadUrl, {
				method: "PUT",
				body: resized.blob,
				headers: { "content-type": prepared.data.contentType }
			});
			if (!uploaded.ok) {
				failure = uploaded.status === 403 ? "Storage rejected the upload. Choose the image again." : "The upload did not finish.";
				return;
			}

			const completed =
				props.purpose === "character"
					? await API.characters.actions.completeCharacterImage({ uploadId: prepared.data.uploadId })
					: await API.images.actions.completeAvatarImage({ uploadId: prepared.data.uploadId });
			if (!completed.ok) {
				failure = completed.error.message;
				return;
			}

			useImageUrl(completed.data.imageUrl, prepared.data.uploadId);
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

<div
	class={[
		"relative mt-2 flex flex-1 flex-col gap-3 rounded-lg border border-dashed p-3 sm:flex-row sm:items-start",
		acceptingDrop ? "border-primary bg-primary/10" : "border-transparent"
	]}
	role="group"
	aria-label={groupLabel}
	ondragenter={onDragEnter}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
>
	{#if acceptingDrop}
		<div
			class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/15 text-sm font-medium text-primary"
		>
			Drop image to upload
		</div>
	{/if}
	<img src={preview} {alt} class={previewClass} />
	<div class="flex min-w-0 flex-1 flex-col gap-2">
		{#if props.purpose === "character"}
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
				<Input field={props.field} type="url" label="Portrait" placeholder="https://" warning={imgurWarning} />
			{:else}
				<div class="mt-2">
					<label
						class={[
							"btn btn-outline btn-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-current",
							uploading && "pointer-events-none opacity-50"
						]}
					>
						{uploading ? "Uploading image…" : "Choose image"}
						<input
							class="sr-only"
							type="file"
							accept="image/jpeg,image/png,image/webp,image/gif"
							aria-describedby={statusId}
							disabled={uploading}
							onchange={onFile}
						/>
					</label>
				</div>
				{#if uploading && status}
					<p id={statusId} class="flex items-center gap-2 text-pretty text-neutral-500">
						<span class="loading loading-xs"></span>
						{status}
					</p>
				{:else if failure}
					<p id={statusId} class="rounded-lg bg-error px-2 py-1 text-pretty text-error-content">{failure}</p>
				{:else}
					<p id={statusId} class="text-pretty text-neutral-500">{help}</p>
				{/if}
				<Input field={props.field} type="hidden" />
			{/if}
		{:else}
			<div class="mt-2">
				<label
					class={[
						"btn btn-outline btn-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-current",
						uploading && "pointer-events-none opacity-50"
					]}
				>
					{uploading ? "Uploading image…" : "Choose image"}
					<input
						class="sr-only"
						type="file"
						accept="image/jpeg,image/png,image/webp,image/gif"
						aria-describedby={statusId}
						disabled={uploading}
						onchange={onFile}
					/>
				</label>
			</div>
			{#if uploading && status}
				<p id={statusId} class="flex items-center gap-2 text-pretty text-neutral-500">
					<span class="loading loading-xs"></span>
					{status}
				</p>
			{:else if failure}
				<p id={statusId} class="rounded-lg bg-error px-2 py-1 text-pretty text-error-content">{failure}</p>
			{:else}
				<p id={statusId} class="text-pretty text-neutral-500">{help}</p>
			{/if}
		{/if}
	</div>
</div>
