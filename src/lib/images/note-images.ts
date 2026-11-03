import escapeRegex from "regexp.escape";
import {
	imagePublicUrl,
	isPermanentNoteImageKey,
	isTemporaryNoteImageKey,
	keyFromPublicUrl,
	permanentImageKeyForTemporary
} from "./object-key";

export interface NoteImageReference {
	/** The URL exactly as it appears in the note. */
	text: string;
	index: number;
	/** `tmp/` or permanent note image key. */
	key: string;
	temporary: boolean;
}

function publicBasePrefix(publicBase: string) {
	const base = new URL(publicBase);
	return `${base.origin}${base.pathname.replace(/\/$/, "")}/`;
}

/**
 * Note image URLs in `markdown` that point at this app's bucket.
 * A match must start at a token boundary (start, whitespace, or one of `( < [ > " '`) so a bucket URL
 * inside another URL's query string is not touched, and it must equal the canonical public URL of
 * its key, so look-alike hosts, query strings, and re-encoded paths are ignored.
 */
export function findNoteImageUrls(markdown: string, publicBase: string): NoteImageReference[] {
	let prefix: string;
	try {
		prefix = publicBasePrefix(publicBase);
	} catch {
		return [];
	}

	const pattern = new RegExp(`(?<=^|[\\s(<\\[>"'])${escapeRegex(prefix)}[^\\s()<>"'\`\\[\\]]+`, "gu");
	const found: NoteImageReference[] = [];
	for (const match of markdown.matchAll(pattern)) {
		const text = match[0];
		const key = keyFromPublicUrl(text, publicBase);
		if (!key || imagePublicUrl(key, publicBase) !== text) continue;
		const temporary = isTemporaryNoteImageKey(key);
		if (!temporary && !isPermanentNoteImageKey(key)) continue;
		found.push({ text, index: match.index, key, temporary });
	}
	return found;
}

/** Distinct images a note references. A `tmp/` URL and its permanent URL are the same image. */
export function distinctNoteImageKeys(references: readonly NoteImageReference[]) {
	return [...new Set(references.map((ref) => (ref.temporary ? (permanentImageKeyForTemporary(ref.key) ?? ref.key) : ref.key)))];
}

/** Replaces each reference whose `replace` result is a string. References must come from the same `markdown`. */
export function rewriteNoteImageUrls(
	markdown: string,
	references: readonly NoteImageReference[],
	replace: (ref: NoteImageReference) => string | null
) {
	let result = markdown;
	for (const ref of [...references].sort((a, b) => b.index - a.index)) {
		const next = replace(ref);
		if (next === null || result.slice(ref.index, ref.index + ref.text.length) !== ref.text) continue;
		result = result.slice(0, ref.index) + next + result.slice(ref.index + ref.text.length);
	}
	return result;
}

export function noteImagePlaceholder(id: string) {
	return `![Uploading image-${id}]()`;
}

/** Markdown for an uploaded image. The alt text is the file name without its extension. */
export function noteImageMarkdown(fileName: string, url: string) {
	const alt =
		fileName
			.replace(/\.[^.]+$/u, "")
			.replace(/[[\]\\\r\n]+/gu, " ")
			.trim() || "image";
	return `![${alt}](${url})`;
}

/**
 * Inserts `text` at `caret`, or at the end when `caret` is null.
 * Appending to a note that does not end in a newline starts a new line.
 */
export function insertNoteText(value: string, text: string, caret: number | null) {
	if (caret === null || caret < 0 || caret > value.length) {
		const separator = value && !value.endsWith("\n") ? "\n" : "";
		const next = `${value}${separator}${text}`;
		return { value: next, caret: next.length };
	}
	return { value: value.slice(0, caret) + text + value.slice(caret), caret: caret + text.length };
}

/** Replaces the first `search`, or returns null when the user already removed it. */
export function replaceNoteText(value: string, search: string, replacement: string) {
	const index = value.indexOf(search);
	if (index < 0) return null;
	return value.slice(0, index) + replacement + value.slice(index + search.length);
}
