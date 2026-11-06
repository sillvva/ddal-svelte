/** True when the drag carries OS files (Finder/Explorer), not a web URL. */
export function isFileDrag(transfer: DataTransfer | null) {
	return !!transfer && [...transfer.types].includes("Files");
}

function isHttpUrl(value: string) {
	try {
		const protocol = new URL(value).protocol;
		return protocol === "http:" || protocol === "https:";
	} catch {
		return false;
	}
}

/** First http(s) URL from a `text/uri-list` payload (RFC 2483: `#` lines are comments). */
function urlFromUriList(text: string) {
	for (const line of text.split(/\r?\n/u)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		if (isHttpUrl(trimmed)) return trimmed;
	}
	return null;
}

/**
 * Prefer an `<img src>` when present (dragging a picture), so a surrounding link's href
 * in `text/uri-list` does not win over the image URL.
 */
function urlFromHtml(html: string) {
	const match = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu.exec(html);
	if (!match) return null;
	const url = (match[1] ?? match[2] ?? match[3] ?? "").trim();
	return isHttpUrl(url) ? url : null;
}

/**
 * http(s) URL from a web-image (or link) drag. Returns null for file drags and non-http payloads.
 * Prefers `text/html` `<img src>`, then `text/uri-list`, then a bare `text/plain` URL.
 */
export function imageUrlFromDataTransfer(transfer: DataTransfer | null) {
	if (!transfer || isFileDrag(transfer)) return null;

	const html = transfer.getData("text/html");
	if (html) {
		const fromHtml = urlFromHtml(html);
		if (fromHtml) return fromHtml;
	}

	const uriList = transfer.getData("text/uri-list");
	if (uriList) {
		const fromList = urlFromUriList(uriList);
		if (fromList) return fromList;
	}

	const plain = transfer.getData("text/plain").trim();
	return isHttpUrl(plain) ? plain : null;
}

/**
 * True when the drag looks like a link or web image (for drag feedback).
 * Uses `text/uri-list` / `text/html` only — plain text selections are not treated as image drags.
 */
export function isImageUrlDrag(transfer: DataTransfer | null) {
	if (!transfer || isFileDrag(transfer)) return false;
	return transfer.types.some((type) => type === "text/uri-list" || type === "text/html");
}

/** File-name-like alt text from a URL path, for Markdown `![alt](url)`. */
export function imageAltFromUrl(url: string) {
	try {
		const leaf = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "");
		return leaf || "image";
	} catch {
		return "image";
	}
}
