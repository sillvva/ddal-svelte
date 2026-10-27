<script lang="ts">
	import { BLANK_CHARACTER } from "#lib/constants.js";
	import { CHARACTER_IMAGE_LIMITS, formatBytes } from "#lib/images/limits.js";
	import { isPermanentCharacterImageKey, isTemporaryCharacterImageKey, keyFromPublicUrl } from "#lib/images/object-key.js";
	import { resizeCharacterImage } from "#lib/images/resize.js";
	import * as API from "#lib/remote/index.js";
	import type { CharacterId } from "#lib/schemas.js";
	import { R2_PUBLIC_URL } from "$app/env/public";
	import type { RemoteFormField } from "$app/server";
	import { untrack } from "svelte";
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

	function isStoredImage(url: string) {
		const key = keyFromPublicUrl(url, R2_PUBLIC_URL);
		if (!key) return false;
		// Staged uploads are public at img.dekok.app under tmp/ until save promotes them.
		return isTemporaryCharacterImageKey(key) || isPermanentCharacterImageKey(key);
	}

	function sourceFor(url: string): ImageSource {
		if (!url || url === BLANK_CHARACTER) return "url";
		const key = keyFromPublicUrl(url, R2_PUBLIC_URL);
		// A saved portrait opens on Upload. A staged tmp/ URL is shown and submitted as a URL; save copies it.
		if (key && isPermanentCharacterImageKey(key)) return "upload";
		return "url";
	}

	const startingUrl = untrack(() => field.value() || savedUrl);
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
	const acceptedTypes: ReadonlySet<string> = new Set(CHARACTER_IMAGE_LIMITS.acceptedInputTypes);

	const preview = $derived(localPreview || field.value() || uploadedUrl || BLANK_CHARACTER);
	const imgurWarning = $derived(
		source === "url" && field.value()?.includes("imgur")
			? "Images from imgur may not appear when sharing links due to rate limiting"
			: undefined
	);
	const help = `JPEG, PNG, WebP, or GIF up to ${formatBytes(CHARACTER_IMAGE_LIMITS.maxOriginalBytes)}. Drop an image here or choose a file.`;

	function setPending(pending: boolean) {
		uploading = pending;
		onpending?.(pending);
	}

	function remember(current: string) {
		if (source === "url") urlDraft = current;
		if (isStoredImage(current)) uploadedUrl = current;
	}

	function choose(next: ImageSource) {
		if (uploading || next === source) return;
		remember(field.value() ?? "");

		source = next;
		failure = "";
		status = "";
		if (next === "url") field.set(urlDraft);
		else field.set(uploadedUrl);
	}

	function showUpload() {
		if (source === "upload") return;
		remember(field.value() ?? "");
		source = "upload";
		field.set(uploadedUrl);
	}

	/** Put a staged `tmp/` URL in the URL input, which is what save submits. */
	function useImageUrl(imageUrl: string) {
		uploadedUrl = imageUrl;
		urlDraft = imageUrl;
		source = "url";
		failure = "";
		status = "";
		field.set(imageUrl);
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

			const uploaded = await fetch(prepared.data.uploadUrl, {
				method: "PUT",
				body: resized.blob,
				headers: { "content-type": prepared.data.contentType }
			});
			if (!uploaded.ok) {
				failure = uploaded.status === 403 ? "Storage rejected the upload. Choose the image again." : "The upload did not finish.";
				return;
			}

			const completed = await API.characters.actions.completeCharacterImage({ uploadId: prepared.data.uploadId });
			if (!completed.ok) {
				failure = completed.error.message;
				return;
			}

			useImageUrl(completed.data.imageUrl);
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
	aria-label="Character portrait. Drop an image to upload."
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
						aria-describedby="character-image-status"
						disabled={uploading}
						onchange={onFile}
					/>
				</label>
			</div>
			{#if uploading && status}
				<p id="character-image-status" class="flex items-center gap-2 text-pretty text-neutral-500">
					<span class="loading loading-xs"></span>
					{status}
				</p>
			{:else if failure}
				<p id="character-image-status" class="rounded-lg bg-error px-2 py-1 text-pretty text-error-content">{failure}</p>
			{:else}
				<p id="character-image-status" class="text-pretty text-neutral-500">{help}</p>
			{/if}
			<Input {field} type="hidden" />
		{/if}
	</div>
</div>
