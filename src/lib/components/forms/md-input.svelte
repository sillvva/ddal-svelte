<script lang="ts">
	import { errorToast } from "#lib/factories.svelte.js";
	import { NOTE_IMAGE_LIMITS } from "#lib/images/limits.js";
	import {
		distinctNoteImageKeys,
		findNoteImageUrls,
		insertNoteText,
		noteImageMarkdown,
		noteImagePlaceholder,
		replaceNoteText
	} from "#lib/images/note-images.js";
	import { resizeNoteImage } from "#lib/images/resize.js";
	import * as API from "#lib/remote/index.js";
	import { R2_PUBLIC_URL } from "$app/env/public";
	import type { RemoteFormField } from "$app/server";
	import { tick } from "svelte";
	import autosize from "svelte-autosize";
	import type { HTMLTextareaAttributes } from "svelte/elements";
	import Markdown from "../markdown.svelte";

	interface Props extends HTMLTextareaAttributes {
		field: RemoteFormField<string>;
		preview?: boolean;
		minRows?: number;
		maxRows?: number;
		maxLength?: number;
		/** Paste or drop image files to upload them into the notes as Markdown images. */
		images?: boolean;
		/** Called with the number of image uploads still running. */
		onpending?: (count: number) => void;
	}

	let { field, preview = false, minRows, maxRows, maxLength, images = false, onpending, ...rest }: Props = $props();

	let mode = $state("edit");
	let pending = $state(0);
	let dragDepth = $state(0);
	let textarea: HTMLTextAreaElement | undefined;

	const attributes = $derived(field.as("text"));
	const name = $derived(attributes.name);
	const issues = $derived(field.issues());
	const value = $derived(field.value() || "");

	const segmenter = new Intl.Segmenter();
	const graphemes = $derived(typeof value === "string" ? [...segmenter.segment(value)] : []);
	const graphemeCount = $derived(graphemes.length);

	const markdownTip = $derived(
		"Supports Markdown and HTML. Scripting, media, and form tags are not allowed for security reasons." +
			(images ? " Paste or drop images to upload them." : "")
	);
	const acceptedTypes: ReadonlySet<string> = new Set(NOTE_IMAGE_LIMITS.acceptedInputTypes);

	/** Uploads finish after the event that started them, so they need the element, not `event.currentTarget`. */
	function trackTextarea(node: HTMLTextAreaElement) {
		textarea = node;
		return () => {
			if (textarea === node) textarea = undefined;
		};
	}

	function imageFiles(transfer: DataTransfer | null) {
		return transfer ? [...transfer.files].filter((file) => acceptedTypes.has(file.type)) : [];
	}

	function isFileTransfer(transfer: DataTransfer | null) {
		return !!transfer && [...transfer.types].includes("Files");
	}

	function setPending(delta: number) {
		pending += delta;
		onpending?.(pending);
	}

	function focusedSelection() {
		if (!textarea || document.activeElement !== textarea) return null;
		return { start: textarea.selectionStart, end: textarea.selectionEnd };
	}

	async function writeValue(next: string, selection: { start: number; end: number } | null) {
		field.set(next);
		await tick();
		if (!textarea) return;
		autosize.update(textarea);
		if (selection && document.activeElement === textarea) textarea.setSelectionRange(selection.start, selection.end);
	}

	/** At the caret, replacing any selection, when the field is focused. Otherwise at the end. */
	function insertPlaceholder(placeholder: string) {
		const current = field.value() || "";
		const selection = focusedSelection();
		const base = selection ? current.slice(0, selection.start) + current.slice(selection.end) : current;
		const inserted = insertNoteText(base, placeholder, selection ? selection.start : null);
		void writeValue(inserted.value, selection && { start: inserted.caret, end: inserted.caret });
	}

	/** Keeps the caret where it was relative to the surrounding text. */
	function replacePlaceholder(placeholder: string, replacement: string) {
		const current = field.value() || "";
		const index = current.indexOf(placeholder);
		const next = replaceNoteText(current, placeholder, replacement);
		if (next === null) return;
		const shift = (position: number) => {
			if (position <= index) return position;
			if (position >= index + placeholder.length) return position + replacement.length - placeholder.length;
			return index + replacement.length;
		};
		const selection = focusedSelection();
		void writeValue(next, selection && { start: shift(selection.start), end: shift(selection.end) });
	}

	async function uploadImage(file: File) {
		const placeholder = noteImagePlaceholder(crypto.randomUUID().slice(0, 8));
		insertPlaceholder(placeholder);
		setPending(1);
		try {
			const resized = await resizeNoteImage(file);
			const prepared = await API.images.actions.prepareNoteImage({
				contentType: resized.contentType,
				bytes: resized.blob.size
			});
			if (!prepared.ok) throw new Error(prepared.error.message);

			const uploaded = await fetch(prepared.data.uploadUrl, {
				method: "PUT",
				body: resized.blob,
				headers: { "content-type": prepared.data.contentType }
			});
			if (!uploaded.ok) {
				throw new Error(uploaded.status === 403 ? "Storage rejected the upload. Try the image again." : "The upload did not finish.");
			}

			const completed = await API.images.actions.completeNoteImage({ uploadId: prepared.data.uploadId });
			if (!completed.ok) throw new Error(completed.error.message);

			replacePlaceholder(placeholder, noteImageMarkdown(file.name, completed.data.imageUrl));
		} catch (error) {
			replacePlaceholder(placeholder, "");
			errorToast(
				error instanceof TypeError
					? "The browser could not reach storage."
					: error instanceof Error
						? error.message
						: "Could not upload the image."
			);
		} finally {
			setPending(-1);
		}
	}

	function startUploads(files: File[]) {
		const referenced = distinctNoteImageKeys(findNoteImageUrls(field.value() || "", R2_PUBLIC_URL)).length;
		const concurrent = NOTE_IMAGE_LIMITS.maxConcurrentUploads - pending;
		const remaining = NOTE_IMAGE_LIMITS.maxImagesPerNote - referenced - pending;
		const slots = Math.min(concurrent, remaining);
		if (slots < files.length) {
			errorToast(
				remaining <= concurrent
					? `Notes can include up to ${NOTE_IMAGE_LIMITS.maxImagesPerNote} uploaded images.`
					: `Up to ${NOTE_IMAGE_LIMITS.maxConcurrentUploads} images upload at once. Wait for the current uploads to finish.`
			);
		}
		for (const file of files.slice(0, Math.max(0, slots))) void uploadImage(file);
	}

	function onpaste(event: ClipboardEvent) {
		if (!images) return;
		const files = imageFiles(event.clipboardData);
		if (!files.length) return;
		event.preventDefault();
		startUploads(files);
	}

	function ondragenter(event: DragEvent) {
		if (!images || !isFileTransfer(event.dataTransfer)) return;
		event.preventDefault();
		dragDepth += 1;
	}

	function ondragover(event: DragEvent) {
		if (!images || !isFileTransfer(event.dataTransfer)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
	}

	function ondragleave() {
		dragDepth = Math.max(0, dragDepth - 1);
	}

	function ondrop(event: DragEvent) {
		if (!images || !isFileTransfer(event.dataTransfer)) return;
		event.preventDefault();
		dragDepth = 0;
		const files = imageFiles(event.dataTransfer);
		if (!files.length) {
			errorToast("Drop a JPEG, PNG, WebP, or GIF image.");
			return;
		}
		startUploads(files);
	}
</script>

<label for={name} class="fieldset-legend">
	<span>Notes</span>
</label>
<div>
	{#if preview}
		<div
			class="tabs-boxed tabs rounded-t-lg rounded-b-none border border-b-0 border-base-content/20 bg-base-200 [--tw-border-opacity:0.2]"
		>
			<input type="radio" role="tab" class="tab rounded-md!" aria-label="Edit" bind:group={mode} value="edit" />
			<input type="radio" role="tab" class="tab rounded-md!" aria-label="Preview" bind:group={mode} value="preview" />
		</div>
	{/if}
	<textarea
		{...rest}
		{name}
		id={name}
		bind:value={() => field.value(), (val) => field.set(val)}
		class={[
			"textarea-bordered textarea w-full rounded-b-lg focus:border-primary data-[preview=true]:rounded-t-none data-[state=preview]:hidden max-sm:text-base",
			dragDepth > 0 && "border-primary bg-primary/10"
		]}
		data-preview={preview}
		data-state={mode}
		aria-busy={pending > 0 || undefined}
		style:--minRows={minRows && `${minRows}lh`}
		style:--maxRows={maxRows && `${maxRows}lh`}
		spellcheck="true"
		{onpaste}
		{ondragenter}
		{ondragover}
		{ondragleave}
		{ondrop}
		{@attach trackTextarea}
		{@attach autosize}></textarea>
	{#if preview && mode === "preview"}
		<div class="rounded-b-lg border border-base-content/20 bg-base-100 p-4 text-sm [--tw-border-opacity:0.2]">
			<Markdown content={field.value()} />
		</div>
	{/if}
</div>
{#if !preview || mode !== "preview"}
	<label for={name} class="fieldset-label justify-between">
		{#if issues?.length}
			<span class="rounded-lg bg-error px-2 py-1 text-pretty text-error-content">{issues}</span>
		{:else if pending > 0}
			<span class="flex items-center gap-2" role="status">
				<span class="loading loading-xs"></span>
				Uploading {pending === 1 ? "1 image" : `${pending} images`}…
			</span>
		{:else}
			<span class="tooltip tooltip-bottom flex items-center gap-1" data-tip={markdownTip}>
				Markdown and HTML Supported
				<span class="iconify mdi--question-mark-circle"></span>
			</span>
		{/if}
		{#if !issues?.length && maxLength}
			<span class="tooltip tooltip-bottom flex items-center gap-1">
				{graphemeCount.toLocaleString()} / {maxLength.toLocaleString()}
			</span>
		{/if}
	</label>
{/if}

<style>
	textarea {
		resize: none;
		min-height: calc(var(--minRows, 3lh) + 1rem + 2px);
		max-height: calc(var(--maxRows, 50lh) + 1rem + 2px);
	}
</style>
