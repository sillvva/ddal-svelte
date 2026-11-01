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
	import type { CharacterId, ImageUploadId } from "#lib/schemas.js";
	import { R2_PUBLIC_URL } from "$app/env/public";
	import type { RemoteFormField } from "$app/server";
	import { untrack } from "svelte";
	import InputWrapper from "./input-wrapper.svelte";

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
		onstaged?: (staged: { uploadId: ImageUploadId; imageUrl: string }) => void;
	}

	type Props = CharacterProps | AvatarProps;

	let props: Props = $props();

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

	const startingUrl = untrack(() =>
		props.purpose === "character" ? fieldValue() || props.savedUrl || "" : props.savedUrl || ""
	);
	let uploadedUrl = $state(isStoredImage(startingUrl) ? startingUrl : "");
	let uploading = $state(false);
	let failure = $state("");
	let status = $state("");
	let dragDepth = $state(0);

	const acceptingDrop = $derived(dragDepth > 0 && !uploading);
	const acceptedTypes = $derived<ReadonlySet<string>>(
		new Set(props.purpose === "character" ? CHARACTER_IMAGE_LIMITS.acceptedInputTypes : AVATAR_IMAGE_LIMITS.acceptedInputTypes)
	);
	const preview = $derived.by(() => {
		if (props.purpose === "character") return props.field.value() || BLANK_CHARACTER;
		return uploadedUrl || props.savedUrl || BLANK_CHARACTER;
	});
	const help = $derived(
		props.purpose === "character"
			? `JPEG, PNG, WebP, or GIF up to ${formatBytes(CHARACTER_IMAGE_LIMITS.maxOriginalBytes)}. Drop an image to upload.`
			: `JPEG, PNG, WebP, or GIF up to ${formatBytes(AVATAR_IMAGE_LIMITS.maxOriginalBytes)}.`
	);
	const statusId = $derived(props.purpose === "character" ? "character-image-status" : "avatar-image-status");
	const groupLabel = $derived(
		props.purpose === "character" ? "Character portrait. Drop an image to upload." : "Profile picture. Drop an image to upload."
	);
	const previewClass = $derived(
		props.purpose === "character"
			? "size-28 shrink-0 rounded-lg border border-base-content/20 object-cover object-top"
			: "size-24 shrink-0 rounded-full border border-base-content/20 object-cover object-center"
	);
	const alt = $derived(props.purpose === "character" ? "Character portrait" : "Profile picture");

	function setPending(pending: boolean) {
		uploading = pending;
		props.onpending?.(pending);
	}

	/** Put a staged `tmp/` URL in the URL input, which is what character save submits. */
	function useImageUrl(imageUrl: string, uploadId: ImageUploadId) {
		uploadedUrl = imageUrl;
		failure = "";
		status = "";
		if (props.purpose === "character") {
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
		failure = "";
		status = "Resizing image…";
		setPending(true);
		let previewUrl = "";

		try {
			const resized = props.purpose === "character" ? await resizeCharacterImage(file) : await resizeAvatarImage(file);
			previewUrl = URL.createObjectURL(resized.blob);

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
			if (previewUrl) URL.revokeObjectURL(previewUrl);
			status = failure ? "" : status;
			setPending(false);
		}
	}
</script>

{#if props.purpose === "character"}
	<div
		class={[
			"relative mt-2 flex flex-1 gap-3 rounded-lg p-2 outline outline-dashed sm:items-start",
			acceptingDrop ? "bg-primary/10 outline-primary" : "outline-base-content/20"
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
			<InputWrapper
				type="url"
				label="Portrait"
				labelFor={props.field.as("url").name}
				fieldErrors={props.field.issues()?.map((issue) => issue.message)}
				description={help}
			>
				<div class="join">
					<label
						class={[
							"btn join-item focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary",
							uploading && "pointer-events-none opacity-50"
						]}
					>
						<span class="iconify mdi--folder-open-outline"></span>
						{#if uploading}
							<span class="xs:hidden">Uploading</span>
						{/if}
						<span class="max-xs:hidden">{uploading ? "Uploading image…" : "Browse"}</span>
						<input
							class="sr-only"
							type="file"
							accept="image/jpeg,image/png,image/webp,image/gif"
							aria-describedby={statusId}
							disabled={uploading}
							onchange={onFile}
						/>
					</label>
					<input
						{...props.field.as("url")}
						aria-invalid={!!props.field.issues()?.length || undefined}
						id={props.field.as("url").name}
						class="input join-item w-full user-invalid:border-error focus:border-primary focus:aria-[invalid]:border-error max-sm:text-base"
						placeholder="https://"
						autocomplete="off"
					/>
				</div>
			</InputWrapper>
		</div>
	</div>
{:else}
	<div
		class={[
			"flex min-h-50.5 flex-col items-center justify-center gap-4 overflow-hidden rounded-[10px] border border-dashed p-6 transition-colors",
			failure ? "border-error bg-error/10" : "border-primary"
		]}
		data-name="Image drop zone"
		role="region"
		aria-label="Image drop zone"
		ondragenter={onDragEnter}
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
	>
		<div class="flex shrink-0 items-center justify-center overflow-hidden rounded-xl" data-name="Upload symbol">
			<img src={preview} {alt} class={previewClass} />
		</div>

		<div class="flex w-full shrink-0 flex-col items-center gap-1 overflow-hidden text-center" data-name="Drop instructions">
			{#if uploadedUrl}
				<p class="w-full text-[14px] leading-5 font-medium text-base-content">Uploaded image</p>
				<p class="w-full text-[12px] leading-4.5 font-normal text-base-content/70">{uploadedUrl}</p>
			{:else}
				<p class="w-full text-[14px] leading-5 font-medium text-base-content">Drag and drop your image here</p>
				{#if failure}
					<p class="w-full rounded-lg bg-error p-2 text-[12px] leading-4.5 text-balance text-error-content">
						{failure}
					</p>
				{:else}
					<p class="w-full text-[12px] leading-4.5 font-normal text-base-content/70">{help}</p>
				{/if}
			{/if}
		</div>

		<label
			class={[
				"btn btn-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary",
				uploading && "pointer-events-none opacity-50"
			]}
		>
			<span class="iconify mdi--folder-open-outline"></span>
			{#if uploading}
				<span class="xs:hidden">Uploading</span>
			{/if}
			<span class="max-xs:hidden">{uploading ? "Uploading image…" : "Browse"}</span>
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
{/if}
