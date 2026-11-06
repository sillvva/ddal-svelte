import { describe, expect, it } from "vitest";
import { imageAltFromUrl, imageUrlFromDataTransfer, isFileDrag, isImageUrlDrag } from "./drag-url";

/** Minimal stand-in: vitest runs in node, so there is no real DataTransfer. */
function transfer(data: Record<string, string>, files = false): DataTransfer {
	const types = files ? ["Files", ...Object.keys(data)] : Object.keys(data);
	return {
		types,
		files: [] as unknown as FileList,
		items: [] as unknown as DataTransferItemList,
		dropEffect: "none",
		effectAllowed: "all",
		getData: (type: string) => data[type] ?? "",
		setData: () => {},
		clearData: () => {},
		setDragImage: () => {}
	};
}

describe("isFileDrag", () => {
	it("detects OS file drags and ignores URL-only payloads", () => {
		expect(isFileDrag(null)).toBe(false);
		expect(isFileDrag(transfer({ "text/uri-list": "https://example.com/a.png" }))).toBe(false);
		expect(isFileDrag(transfer({}, true))).toBe(true);
	});
});

describe("imageUrlFromDataTransfer", () => {
	it("returns null for missing transfers and file drags", () => {
		expect(imageUrlFromDataTransfer(null)).toBeNull();
		expect(imageUrlFromDataTransfer(transfer({ "text/uri-list": "https://example.com/a.png" }, true))).toBeNull();
	});

	it("prefers an img src from HTML over a surrounding link in uri-list", () => {
		expect(
			imageUrlFromDataTransfer(
				transfer({
					"text/html": `<a href="https://example.com/page"><img src="https://cdn.example.com/portrait.png"></a>`,
					"text/uri-list": "https://example.com/page"
				})
			)
		).toBe("https://cdn.example.com/portrait.png");
	});

	it("reads the first http(s) URL from uri-list, skipping comments", () => {
		expect(
			imageUrlFromDataTransfer(
				transfer({
					"text/uri-list": "# comment\nhttps://cdn.example.com/a.webp\nhttps://cdn.example.com/b.webp"
				})
			)
		).toBe("https://cdn.example.com/a.webp");
	});

	it("falls back to a bare text/plain http(s) URL", () => {
		expect(imageUrlFromDataTransfer(transfer({ "text/plain": "https://cdn.example.com/solo.gif" }))).toBe(
			"https://cdn.example.com/solo.gif"
		);
	});

	it("rejects non-http schemes and empty payloads", () => {
		expect(imageUrlFromDataTransfer(transfer({ "text/uri-list": "javascript:alert(1)" }))).toBeNull();
		expect(imageUrlFromDataTransfer(transfer({ "text/plain": "ftp://example.com/a.png" }))).toBeNull();
		expect(imageUrlFromDataTransfer(transfer({ "text/html": "<div>no image</div>" }))).toBeNull();
	});

	it("accepts single-quoted and unquoted img src values", () => {
		expect(imageUrlFromDataTransfer(transfer({ "text/html": `<img alt='x' src='https://a.test/x.jpg'>` }))).toBe(
			"https://a.test/x.jpg"
		);
		expect(imageUrlFromDataTransfer(transfer({ "text/html": `<img src=https://a.test/y.png>` }))).toBe("https://a.test/y.png");
	});
});

describe("isImageUrlDrag", () => {
	it("is true for uri-list/html and false for file or plain-text-only drags", () => {
		expect(isImageUrlDrag(null)).toBe(false);
		expect(isImageUrlDrag(transfer({ "text/uri-list": "https://example.com/a.png" }))).toBe(true);
		expect(isImageUrlDrag(transfer({ "text/html": "<img src='https://a.test/x.jpg'>" }))).toBe(true);
		expect(isImageUrlDrag(transfer({ "text/plain": "https://example.com/a.png" }))).toBe(false);
		expect(isImageUrlDrag(transfer({}, true))).toBe(false);
	});
});

describe("imageAltFromUrl", () => {
	it("uses the last path segment, or image when missing", () => {
		expect(imageAltFromUrl("https://cdn.example.com/path/portrait%20shot.png")).toBe("portrait shot.png");
		expect(imageAltFromUrl("https://cdn.example.com/")).toBe("image");
		expect(imageAltFromUrl("not a url")).toBe("image");
	});
});
