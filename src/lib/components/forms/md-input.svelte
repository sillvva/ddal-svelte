<script lang="ts">
	import { errorToast } from "#lib/factories.svelte.js";
	import { imageAltFromUrl, imageUrlFromDataTransfer, isFileDrag, isImageUrlDrag } from "#lib/images/drag-url.js";
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
	import {
		headingLevelAt,
		imageMarkdown,
		insertDetails,
		insertTable,
		linkMarkdown,
		normalizeUrl,
		replaceSelection,
		setHeading,
		toggleInline,
		toggleLines,
		type InlineFormat,
		type LineFormat,
		type TextEdit
	} from "#lib/markdown-format.js";
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
		/** Refuse pasted or dropped images instead of uploading them. */
		rejectImages?: boolean;
		/** Called with the number of image uploads still running. */
		onpending?: (count: number) => void;
	}

	let {
		field,
		preview = false,
		minRows,
		maxRows,
		maxLength,
		images = false,
		rejectImages = false,
		onpending,
		...rest
	}: Props = $props();

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
			(images
				? " Paste or drop images to upload them. Drop a web image to insert its URL."
				: " Drop a web image to insert its URL.")
	);
	const acceptedTypes: ReadonlySet<string> = new Set(NOTE_IMAGE_LIMITS.acceptedInputTypes);

	const uid = $props.id();
	const HEADINGS = [
		{ level: 0, label: "P", name: "Paragraph", class: "text-sm" },
		{ level: 1, label: "H1", name: "Heading 1", class: "text-2xl font-bold" },
		{ level: 2, label: "H2", name: "Heading 2", class: "text-xl font-bold" },
		{ level: 3, label: "H3", name: "Heading 3", class: "text-lg font-semibold" },
		{ level: 4, label: "H4", name: "Heading 4", class: "text-base font-semibold" }
	] as const;

	/** Null until the textarea is first focused, so toolbar edits before then go at the end. */
	let caret = $state<number | null>(null);
	let menuSelection = { start: 0, end: 0 };
	let headingMenu = $state<HTMLElement>();
	let linkMenu = $state<HTMLElement>();
	let linkUrlInput = $state<HTMLInputElement>();
	let linkText = $state("");
	let linkUrl = $state("");
	let linkError = $state("");
	let imageMenu = $state<HTMLElement>();
	let imageUrlInput = $state<HTMLInputElement>();
	let imageAlt = $state("");
	let imageUrl = $state("");
	let imageError = $state("");
	let fileInput = $state<HTMLInputElement>();

	const previewing = $derived(preview && mode === "preview");
	const headingLevel = $derived(headingLevelAt(value, caret ?? value.length));
	const headingLabel = $derived(HEADINGS.find((heading) => heading.level === headingLevel)?.label ?? `H${headingLevel}`);

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
				throw new Error(
					uploaded.status === 403 ? "Storage rejected the upload. Try the image again." : "The upload did not finish."
				);
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

	function refuseImageTransfer(event: ClipboardEvent | DragEvent) {
		if (!rejectImages || !isFileDrag(event instanceof DragEvent ? event.dataTransfer : event.clipboardData)) return false;
		const files = imageFiles(event instanceof DragEvent ? event.dataTransfer : event.clipboardData);
		if (!files.length) return false;
		event.preventDefault();
		errorToast("Images can't be uploaded to a log draft.");
		return true;
	}

	function onpaste(event: ClipboardEvent) {
		if (refuseImageTransfer(event)) return;
		if (!images) return;
		const files = imageFiles(event.clipboardData);
		if (!files.length) return;
		event.preventDefault();
		startUploads(files);
	}

	function ondragenter(event: DragEvent) {
		if (rejectImages && isFileDrag(event.dataTransfer)) {
			event.preventDefault();
			return;
		}
		const fileDrag = images && isFileDrag(event.dataTransfer);
		const urlDrag = isImageUrlDrag(event.dataTransfer);
		if (!fileDrag && !urlDrag) return;
		event.preventDefault();
		dragDepth += 1;
	}

	function ondragover(event: DragEvent) {
		if (rejectImages && isFileDrag(event.dataTransfer)) {
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
			return;
		}
		const fileDrag = images && isFileDrag(event.dataTransfer);
		const urlDrag = isImageUrlDrag(event.dataTransfer);
		if (!fileDrag && !urlDrag) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
	}

	function ondragleave() {
		dragDepth = Math.max(0, dragDepth - 1);
	}

	function ondrop(event: DragEvent) {
		if (refuseImageTransfer(event)) return;
		if (images && isFileDrag(event.dataTransfer)) {
			event.preventDefault();
			dragDepth = 0;
			const files = imageFiles(event.dataTransfer);
			if (!files.length) {
				errorToast("Drop a JPEG, PNG, WebP, or GIF image.");
				return;
			}
			startUploads(files);
			return;
		}
		const url = imageUrlFromDataTransfer(event.dataTransfer);
		if (!url) return;
		event.preventDefault();
		dragDepth = 0;
		insertPlaceholder(noteImageMarkdown(imageAltFromUrl(url), url));
	}

	function syncCaret() {
		if (textarea) caret = textarea.selectionStart;
	}

	/** The textarea keeps its selection while toolbar controls have focus. */
	function editorSelection() {
		const current = field.value() || "";
		if (!textarea || caret === null) return { start: current.length, end: current.length };
		return { start: textarea.selectionStart, end: textarea.selectionEnd };
	}

	function selectText(start: number, end: number) {
		if (!textarea) return;
		textarea.focus();
		textarea.setSelectionRange(start, end);
		syncCaret();
	}

	/** `insertText` puts the change on the browser's undo stack, which setting the value directly would clear. */
	function replaceValue(current: string, next: string) {
		if (!textarea) return;
		const shortest = Math.min(current.length, next.length);
		let prefix = 0;
		while (prefix < shortest && current[prefix] === next[prefix]) prefix++;
		let suffix = 0;
		while (suffix < shortest - prefix && current[current.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++;

		const inserted = next.slice(prefix, next.length - suffix);
		selectText(prefix, current.length - suffix);
		const replaced = document.execCommand(inserted ? "insertText" : "delete", false, inserted);
		if (!replaced || textarea.value !== next) field.set(next);
	}

	async function applyEdit(edit: (value: string, start: number, end: number) => TextEdit, selection = editorSelection()) {
		if (!textarea || previewing) return;
		const current = field.value() || "";
		const next = edit(current, selection.start, selection.end);
		if (next.value !== current) replaceValue(current, next.value);
		await tick();
		if (!textarea) return;
		autosize.update(textarea);
		selectText(next.start, next.end);
	}

	const inline = (format: InlineFormat) => () => applyEdit((v, s, e) => toggleInline(v, s, e, format));
	const lines = (format: LineFormat) => () => applyEdit((v, s, e) => toggleLines(v, s, e, format));

	function setHeadingLevel(level: number) {
		headingMenu?.hidePopover();
		void applyEdit((v, s, e) => setHeading(v, s, e, level));
	}

	/** Toolbar buttons keep focus in the textarea so mobile keyboards stay open. */
	function keepFocus(event: MouseEvent) {
		event.preventDefault();
	}

	/** Enter in a menu field would otherwise submit the surrounding form. */
	function onEnter(action: () => void) {
		return (event: KeyboardEvent) => {
			if (event.key !== "Enter") return;
			event.preventDefault();
			action();
		};
	}

	function onlinktoggle(event: ToggleEvent) {
		if (event.newState !== "open") return;
		menuSelection = editorSelection();
		linkText = value.slice(menuSelection.start, menuSelection.end).trim();
		linkUrl = "";
		linkError = "";
		linkUrlInput?.focus();
	}

	function insertLink() {
		const url = normalizeUrl(linkUrl, ["http:", "https:", "mailto:"]);
		if (!url) {
			linkError = "Enter a valid web or email address.";
			return;
		}
		const markdown = linkMarkdown(linkText.trim() || linkUrl.trim(), url);
		linkMenu?.hidePopover();
		void applyEdit((v, s, e) => replaceSelection(v, s, e, markdown), menuSelection);
	}

	function onimagetoggle(event: ToggleEvent) {
		if (event.newState !== "open") return;
		menuSelection = editorSelection();
		imageAlt = "";
		imageUrl = "";
		imageError = "";
		imageUrlInput?.focus();
	}

	function insertImageUrl() {
		const url = normalizeUrl(imageUrl, ["http:", "https:"]);
		if (!url) {
			imageError = "Enter a valid image URL.";
			return;
		}
		const markdown = imageMarkdown(imageAlt.trim() || imageAltFromUrl(url), url);
		imageMenu?.hidePopover();
		void applyEdit((v, s, e) => replaceSelection(v, s, e, markdown), menuSelection);
	}

	function chooseImageFiles() {
		imageMenu?.hidePopover();
		fileInput?.click();
	}

	function onfilechange(event: Event & { currentTarget: HTMLInputElement }) {
		const chosen = [...(event.currentTarget.files ?? [])];
		event.currentTarget.value = "";
		const files = chosen.filter((file) => acceptedTypes.has(file.type));
		if (!files.length) {
			if (chosen.length) errorToast("Choose a JPEG, PNG, WebP, or GIF image.");
			return;
		}
		selectText(menuSelection.start, menuSelection.end);
		startUploads(files);
	}
</script>

{#snippet tool(label: string, icon: string, onclick: () => void)}
	<button
		type="button"
		class="btn btn-square btn-ghost btn-sm"
		aria-label={label}
		title={label}
		disabled={previewing}
		onmousedown={keepFocus}
		{onclick}
	>
		<span class={["iconify size-5", icon]}></span>
	</button>
{/snippet}

{#snippet divider()}
	<span class="mx-0.5 h-5 w-px bg-base-content/20" aria-hidden="true"></span>
{/snippet}

<label for={name} class="fieldset-legend">
	<span>Notes</span>
</label>
<div>
	<div
		class="flex flex-wrap items-center justify-between rounded-t-lg border border-b-0 border-base-content/20 bg-base-200 [--tw-border-opacity:0.2]"
	>
		{#if preview}
			<div class="tabs-boxed tabs">
				<input type="radio" role="tab" class="tab rounded-md!" aria-label="Edit" bind:group={mode} value="edit" />
				<input type="radio" role="tab" class="tab rounded-md!" aria-label="Preview" bind:group={mode} value="preview" />
			</div>
		{/if}
		<div role="group" aria-label="Formatting" class="flex flex-wrap items-center gap-0.5 p-1">
			{@render tool("Bold", "mdi--format-bold", inline("bold"))}
			{@render tool("Italic", "mdi--format-italic", inline("italic"))}
			{@render tool("Strikethrough", "mdi--format-strikethrough-variant", inline("strikethrough"))}
			<button
				type="button"
				class="btn w-14 justify-between btn-ghost px-2 btn-sm"
				aria-label="Text style"
				aria-haspopup="menu"
				title="Text style"
				disabled={previewing}
				popovertarget="{uid}-heading"
				style:anchor-name="--{uid}-heading"
				onmousedown={keepFocus}
			>
				{headingLabel}
				<span class="iconify size-4 mdi--chevron-down"></span>
			</button>
			<ul
				id="{uid}-heading"
				popover
				role="menu"
				aria-label="Text style"
				class="menu dropdown dropdown-start dropdown-bottom z-30 mt-1 w-40 rounded-box bg-base-200 p-2 shadow-lg"
				style:position-anchor="--{uid}-heading"
				bind:this={headingMenu}
			>
				{#each HEADINGS as heading (heading.level)}
					<li role="none">
						<button
							type="button"
							role="menuitemradio"
							aria-checked={heading.level === headingLevel}
							class={[heading.class, heading.level === headingLevel && "menu-active"]}
							onmousedown={keepFocus}
							onclick={() => setHeadingLevel(heading.level)}
						>
							{heading.name}
						</button>
					</li>
				{/each}
			</ul>
			{@render divider()}
			{@render tool("Bulleted list", "mdi--format-list-bulleted", lines("unordered"))}
			{@render tool("Numbered list", "mdi--format-list-numbered", lines("ordered"))}
			{@render tool("Blockquote", "mdi--format-quote-close", lines("quote"))}
			{@render tool("Table", "mdi--table", () => applyEdit(insertTable))}
			{@render divider()}
			<button
				type="button"
				class="btn btn-square btn-ghost btn-sm"
				aria-label="Link"
				title="Link"
				disabled={previewing}
				popovertarget="{uid}-link"
				style:anchor-name="--{uid}-link"
			>
				<span class="iconify size-5 mdi--link-variant"></span>
			</button>
			<div
				id="{uid}-link"
				popover
				role="dialog"
				aria-label="Insert link"
				class="dropdown dropdown-end dropdown-bottom z-30 mt-1 w-72 rounded-box bg-base-200 p-3 shadow-lg"
				style:position-anchor="--{uid}-link"
				bind:this={linkMenu}
				ontoggle={onlinktoggle}
			>
				<div class="flex flex-col gap-2">
					<label class="input w-full input-sm">
						<span class="label">Text</span>
						<input type="text" bind:value={linkText} onkeydown={onEnter(insertLink)} />
					</label>
					<label class="input w-full input-sm">
						<span class="label">URL</span>
						<input
							type="text"
							inputmode="url"
							placeholder="https://"
							bind:value={linkUrl}
							bind:this={linkUrlInput}
							onkeydown={onEnter(insertLink)}
						/>
					</label>
					{#if linkError}
						<p class="text-xs text-error">{linkError}</p>
					{/if}
					<div class="flex justify-start gap-2">
						<button type="button" class="btn btn-primary btn-sm" onclick={insertLink}>Insert</button>
					</div>
				</div>
			</div>
			<button
				type="button"
				class="btn btn-square btn-ghost btn-sm"
				aria-label="Image"
				title="Image"
				disabled={previewing}
				popovertarget="{uid}-image"
				style:anchor-name="--{uid}-image"
			>
				<span class="iconify size-5 mdi--image-outline"></span>
			</button>
			<div
				id="{uid}-image"
				popover
				role="dialog"
				aria-label="Insert image"
				class="dropdown dropdown-end dropdown-bottom z-30 mt-1 w-72 rounded-box bg-base-200 p-3 shadow-lg"
				style:position-anchor="--{uid}-image"
				bind:this={imageMenu}
				ontoggle={onimagetoggle}
			>
				<div class="flex flex-col gap-2">
					<label class="input w-full input-sm">
						<span class="label">URL</span>
						<input
							type="text"
							inputmode="url"
							placeholder="https://"
							bind:value={imageUrl}
							bind:this={imageUrlInput}
							onkeydown={onEnter(insertImageUrl)}
						/>
					</label>
					<label class="input w-full input-sm">
						<span class="label">Alt text</span>
						<input type="text" bind:value={imageAlt} onkeydown={onEnter(insertImageUrl)} />
					</label>
					{#if imageError}
						<p class="text-xs text-error">{imageError}</p>
					{/if}
					<div class="flex items-center justify-start gap-2">
						<button type="button" class="btn btn-primary btn-sm" onclick={insertImageUrl}>Insert</button>
						{#if images}
							<div class="flex flex-1 justify-center text-xs">or</div>
							<button type="button" class="btn btn-outline btn-sm" onclick={chooseImageFiles}>
								<span class="iconify size-4 mdi--upload"></span>
								Upload image
							</button>
						{/if}
					</div>
				</div>
			</div>
			{#if images}
				<input
					type="file"
					class="hidden"
					accept={NOTE_IMAGE_LIMITS.acceptedInputTypes.join(",")}
					multiple
					tabindex="-1"
					aria-hidden="true"
					bind:this={fileInput}
					onchange={onfilechange}
				/>
			{/if}
			{@render tool("Collapsible section", "mdi--unfold-more-horizontal", () => applyEdit(insertDetails))}
		</div>
	</div>
	<textarea
		{...rest}
		{name}
		id={name}
		bind:value={() => field.value(), (val) => field.set(val)}
		class={[
			"textarea-bordered textarea w-full rounded-t-none rounded-b-lg focus:border-primary data-[state=preview]:hidden max-sm:text-base",
			dragDepth > 0 && "border-primary bg-primary/10"
		]}
		data-preview={preview}
		data-state={mode}
		aria-busy={pending > 0 || undefined}
		style:--minRows={minRows && `${minRows}lh`}
		style:--maxRows={maxRows && `${maxRows}lh`}
		spellcheck="true"
		onfocus={syncCaret}
		onselect={syncCaret}
		onkeyup={syncCaret}
		onpointerup={syncCaret}
		oninput={syncCaret}
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
			<span class="rounded-lg bg-error px-2 py-1 text-pretty text-error-content">
				{issues.map((issue) => issue.message).join(" ")}
			</span>
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

	@media (width < 40rem) {
		textarea {
			max-height: calc(min(var(--maxRows, 50lh), 12lh) + 1rem + 2px);
		}
	}
</style>
