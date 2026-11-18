/** A textarea value and the selection to restore after an edit. */
export interface TextEdit {
	value: string;
	start: number;
	end: number;
}

export type InlineFormat = "bold" | "italic" | "strikethrough";
export type LineFormat = "unordered" | "ordered" | "quote";

const INLINE_MARKERS: Record<InlineFormat, string> = {
	bold: "**",
	italic: "_",
	strikethrough: "~~"
};

const UNORDERED_PREFIX = /^(\s*)[-*+][ \t]+/u;
const ORDERED_PREFIX = /^(\s*)\d+[.)][ \t]+/u;
const QUOTE_PREFIX = /^()>[ \t]?/u;
const HEADING_PREFIX = /^(#{1,6})[ \t]+/u;

const LINE_PREFIXES: Record<LineFormat, RegExp> = {
	unordered: UNORDERED_PREFIX,
	ordered: ORDERED_PREFIX,
	quote: QUOTE_PREFIX
};

/**
 * Wraps the selection in the format's marker, or unwraps it when it is already wrapped.
 * Whitespace at either end of the selection stays outside the markers.
 */
export function toggleInline(value: string, start: number, end: number, format: InlineFormat): TextEdit {
	const marker = INLINE_MARKERS[format];
	const size = marker.length;
	const selected = value.slice(start, end);
	const from = start + selected.length - selected.trimStart().length;
	const to = selected.trim() ? end - (selected.length - selected.trimEnd().length) : from;
	const inner = value.slice(from, to);

	if (from >= size && value.slice(from - size, from) === marker && value.slice(to, to + size) === marker) {
		return {
			value: value.slice(0, from - size) + inner + value.slice(to + size),
			start: from - size,
			end: to - size
		};
	}

	if (inner.length >= size * 2 && inner.startsWith(marker) && inner.endsWith(marker)) {
		const unwrapped = inner.slice(size, -size);
		return {
			value: value.slice(0, from) + unwrapped + value.slice(to),
			start: from,
			end: from + unwrapped.length
		};
	}

	return {
		value: value.slice(0, from) + marker + inner + marker + value.slice(to),
		start: from + size,
		end: to + size
	};
}

interface Line {
	start: number;
	text: string;
}

/** Remove `remove` characters at the start of the line, then insert `insert` there. */
interface LineChange {
	remove: number;
	insert: string;
}

function lineStartAt(value: string, position: number) {
	return position === 0 ? 0 : value.lastIndexOf("\n", position - 1) + 1;
}

/** Every line the selection touches. A selection that ends at the start of a line does not include it. */
function selectedLines(value: string, start: number, end: number): Line[] {
	const first = lineStartAt(value, start);
	const last = end > start && value[end - 1] === "\n" ? end - 1 : end;
	const stop = value.indexOf("\n", last);
	const lines: Line[] = [];
	let offset = first;
	for (const text of value.slice(first, stop < 0 ? value.length : stop).split("\n")) {
		lines.push({ start: offset, text });
		offset += text.length + 1;
	}
	return lines;
}

/** Blank lines are skipped unless every selected line is blank. */
function targetLines(lines: Line[]) {
	const filled = lines.filter((line) => line.text.trim());
	return filled.length ? filled : lines;
}

/**
 * Applies `change` to each target line. A caret keeps its place in the text; a range selection
 * grows to cover the changed lines so the same button can toggle them back.
 */
function editLines(
	value: string,
	start: number,
	end: number,
	lines: Line[],
	change: (line: Line, index: number) => LineChange | null
): TextEdit {
	let next = "";
	let copied = 0;
	let offset = 0;
	let caret = start;

	for (const [index, line] of targetLines(lines).entries()) {
		const edit = change(line, index);
		if (!edit) continue;
		next += value.slice(copied, line.start) + edit.insert;
		copied = line.start + edit.remove;
		if (start >= line.start + edit.remove) caret += edit.insert.length - edit.remove;
		else if (start >= line.start) caret = line.start + offset + edit.insert.length;
		offset += edit.insert.length - edit.remove;
	}
	next += value.slice(copied);

	if (start === end) return { value: next, start: caret, end: caret };
	const first = lines[0];
	const last = lines[lines.length - 1];
	if (!first || !last) return { value: next, start, end };
	return { value: next, start: first.start, end: last.start + last.text.length + offset };
}

/** Toggles a list or blockquote prefix on the selected lines. Switching list types replaces the old marker. */
export function toggleLines(value: string, start: number, end: number, format: LineFormat): TextEdit {
	const lines = selectedLines(value, start, end);
	const pattern = LINE_PREFIXES[format];
	const active = targetLines(lines).every((line) => pattern.test(line.text));

	return editLines(value, start, end, lines, (line, index) => {
		if (active) {
			const match = pattern.exec(line.text);
			return match ? { remove: match[0].length, insert: match[1] ?? "" } : null;
		}
		if (format === "quote") return { remove: 0, insert: "> " };

		const marker = format === "ordered" ? `${index + 1}. ` : "- ";
		const existing = UNORDERED_PREFIX.exec(line.text) ?? ORDERED_PREFIX.exec(line.text);
		const indent = existing?.[1] ?? /^\s*/u.exec(line.text)?.[0] ?? "";
		return { remove: existing ? existing[0].length : indent.length, insert: indent + marker };
	});
}

/** Sets the selected lines to a heading level, or to a paragraph when `level` is 0. */
export function setHeading(value: string, start: number, end: number, level: number): TextEdit {
	const insert = level > 0 ? `${"#".repeat(level)} ` : "";
	return editLines(value, start, end, selectedLines(value, start, end), (line) => {
		const remove = HEADING_PREFIX.exec(line.text)?.[0].length ?? 0;
		return remove || insert ? { remove, insert } : null;
	});
}

/** Heading level of the line containing `position`, or 0 for a paragraph. */
export function headingLevelAt(value: string, position: number) {
	const from = lineStartAt(value, position);
	return HEADING_PREFIX.exec(value.slice(from, from + 7))?.[1]?.length ?? 0;
}

/** Inserts `block` as its own paragraph and selects `selectedText` inside it. */
function insertBlock(value: string, start: number, end: number, block: string, selectedText: string): TextEdit {
	const before = value.slice(0, start);
	const after = value.slice(end);
	const lead = !before || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
	const trail = !after || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
	const selectFrom = start + lead.length + Math.max(0, block.indexOf(selectedText));
	return {
		value: before + lead + block + trail + after,
		start: selectFrom,
		end: selectFrom + selectedText.length
	};
}

/** Inserts a two-column table after the selection. */
export function insertTable(value: string, _start: number, end: number): TextEdit {
	const table = ["| Column 1 | Column 2 |", "| -------- | -------- |", "|          |          |"].join("\n");
	return insertBlock(value, end, end, table, "Column 1");
}

/** Wraps the selection in a collapsible `<details>` block and selects its summary. */
export function insertDetails(value: string, start: number, end: number): TextEdit {
	const content = value.slice(start, end).trim() || "Details";
	const block = `<details>\n<summary>Summary</summary>\n\n${content}\n\n</details>`;
	return insertBlock(value, start, end, block, "Summary");
}

/** Replaces the selection with `text` and places the caret after it. */
export function replaceSelection(value: string, start: number, end: number, text: string): TextEdit {
	const caret = start + text.length;
	return { value: value.slice(0, start) + text + value.slice(end), start: caret, end: caret };
}

function escapeLinkText(text: string) {
	return text.replace(/[\r\n]+/gu, " ").replace(/[\\[\]]/gu, "\\$&");
}

export function linkMarkdown(text: string, url: string) {
	return `[${escapeLinkText(text)}](${url})`;
}

export function imageMarkdown(alt: string, url: string) {
	return `![${escapeLinkText(alt)}](${url})`;
}

/**
 * A URL safe to place in a Markdown link destination, or null when it is not a valid URL with one of `protocols`.
 * Input without a scheme is treated as `https://`.
 */
export function normalizeUrl(input: string, protocols: readonly string[]) {
	const trimmed = input.trim();
	if (!trimmed) return null;
	const candidate = /^[a-z][a-z\d+.-]*:/iu.test(trimmed) ? trimmed : `https://${trimmed}`;
	let url: URL;
	try {
		url = new URL(candidate);
	} catch {
		return null;
	}
	if (!protocols.includes(url.protocol)) return null;
	return candidate.replace(/[\s()<>]/gu, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
}
