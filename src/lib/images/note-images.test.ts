import { v7 } from "uuid";
import { describe, expect, it } from "vitest";
import {
	distinctNoteImageKeys,
	findNoteImageUrls,
	insertNoteText,
	noteImageMarkdown,
	noteImagePlaceholder,
	replaceNoteText,
	rewriteNoteImageUrls
} from "./note-images";
import {
	imagePublicUrl,
	isOwnedNoteImageKey,
	isOwnedTemporaryNoteImageKey,
	isPermanentImageKey,
	isPermanentNoteImageKey,
	isTemporaryImageKey,
	isTemporaryNoteImageKey,
	permanentImageKeyForTemporary,
	permanentNoteImageKey,
	temporaryNoteImageKey,
	uploadIdFromImageKey,
	userIdFromPermanentKey
} from "./object-key";

const BASE = "https://img.example.com";
const PATH_BASE = "http://127.0.0.1:9000/e2e";
const userId = v7();
const otherUserId = v7();

function noteKeys(owner = userId) {
	const uploadId = v7();
	return {
		uploadId,
		permanent: permanentNoteImageKey(owner, uploadId, "image/webp"),
		temporary: temporaryNoteImageKey(owner, uploadId, "image/webp")
	};
}

describe("note image keys", () => {
	it("issues per-account keys under users/{id}/notes/", () => {
		const { uploadId, permanent, temporary } = noteKeys();
		expect(permanent).toBe(`users/${userId}/notes/${uploadId}.webp`);
		expect(temporary).toBe(`tmp/${permanent}`);
		expect(permanentNoteImageKey(userId, uploadId, "image/jpeg")).toBe(`users/${userId}/notes/${uploadId}.jpg`);
		expect(uploadIdFromImageKey(temporary)).toBe(uploadId);
	});

	it("recognizes note keys as app image keys", () => {
		const { permanent, temporary } = noteKeys();
		expect(isPermanentNoteImageKey(permanent)).toBe(true);
		expect(isTemporaryNoteImageKey(temporary)).toBe(true);
		expect(isPermanentImageKey(permanent)).toBe(true);
		expect(isTemporaryImageKey(temporary)).toBe(true);
		expect(permanentImageKeyForTemporary(temporary)).toBe(permanent);
		expect(userIdFromPermanentKey(permanent)).toBe(userId);
	});

	it("rejects keys outside the note shape", () => {
		const uploadId = v7();
		expect(isPermanentNoteImageKey(`users/${userId}/notes/${uploadId}.png`)).toBe(false);
		expect(isPermanentNoteImageKey(`users/${userId}/notes/not-a-uuid.webp`)).toBe(false);
		expect(isPermanentNoteImageKey(`users/${userId}/notes/../avatar/${uploadId}.webp`)).toBe(false);
		expect(isTemporaryNoteImageKey(`users/${userId}/notes/${uploadId}.webp`)).toBe(false);
	});

	it("only treats the account's own keys as owned", () => {
		const mine = noteKeys();
		const theirs = noteKeys(otherUserId);
		expect(isOwnedNoteImageKey(userId, mine.permanent)).toBe(true);
		expect(isOwnedNoteImageKey(userId, theirs.permanent)).toBe(false);
		expect(isOwnedTemporaryNoteImageKey(userId, mine.temporary)).toBe(true);
		expect(isOwnedTemporaryNoteImageKey(userId, theirs.temporary)).toBe(false);
		expect(isOwnedTemporaryNoteImageKey(userId, mine.permanent)).toBe(false);
	});
});

describe("findNoteImageUrls", () => {
	it("finds staged and permanent note images in Markdown and HTML", () => {
		const staged = noteKeys();
		const saved = noteKeys();
		const markdown = [
			`Intro ![map](${imagePublicUrl(staged.temporary, BASE)}) text`,
			`<img src="${imagePublicUrl(saved.permanent, BASE)}">`,
			`![title](${imagePublicUrl(saved.permanent, BASE)} "Title")`
		].join("\n");

		const found = findNoteImageUrls(markdown, BASE);
		expect(found.map((ref) => ({ key: ref.key, temporary: ref.temporary }))).toEqual([
			{ key: staged.temporary, temporary: true },
			{ key: saved.permanent, temporary: false },
			{ key: saved.permanent, temporary: false }
		]);
		for (const ref of found) expect(markdown.slice(ref.index, ref.index + ref.text.length)).toBe(ref.text);
	});

	it("respects a public base with a path", () => {
		const { temporary } = noteKeys();
		const url = imagePublicUrl(temporary, PATH_BASE);
		expect(url).toBe(`${PATH_BASE}/${temporary}`);
		expect(findNoteImageUrls(`![x](${url})`, PATH_BASE).map((ref) => ref.key)).toEqual([temporary]);
		expect(findNoteImageUrls(`![x](http://127.0.0.1:9000/${temporary})`, PATH_BASE)).toEqual([]);
	});

	it("ignores external URLs, look-alike hosts, and non-canonical variants", () => {
		const { temporary, permanent } = noteKeys();
		const markdown = [
			`![a](https://evil.example.com/${temporary})`,
			`![b](https://img.example.com.evil.com/${temporary})`,
			`![c](${imagePublicUrl(temporary, BASE)}?width=10)`,
			`![d](${imagePublicUrl(temporary, BASE)}#frag)`,
			`![e](http://img.example.com/${permanent})`,
			`![f](https://other.example.com/?u=${imagePublicUrl(permanent, BASE)})`,
			`![g](${BASE}/users/${userId}/characters/${v7()}/${v7()}.webp)`
		].join("\n");
		expect(findNoteImageUrls(markdown, BASE)).toEqual([]);
	});

	it("returns nothing for an invalid public base", () => {
		expect(findNoteImageUrls("anything", "not a url")).toEqual([]);
	});
});

describe("distinctNoteImageKeys", () => {
	it("counts a staged URL and its permanent URL as one image", () => {
		const one = noteKeys();
		const two = noteKeys();
		const markdown = [
			imagePublicUrl(one.temporary, BASE),
			imagePublicUrl(one.permanent, BASE),
			imagePublicUrl(two.permanent, BASE),
			imagePublicUrl(two.permanent, BASE)
		].join(" ");
		expect(distinctNoteImageKeys(findNoteImageUrls(markdown, BASE)).sort()).toEqual([one.permanent, two.permanent].sort());
	});
});

describe("rewriteNoteImageUrls", () => {
	it("replaces staged URLs with permanent URLs and leaves the rest of the note alone", () => {
		const one = noteKeys();
		const two = noteKeys();
		const external = "https://example.com/picture.png";
		const markdown = `A ![one](${imagePublicUrl(one.temporary, BASE)}) B ![ext](${external}) C ![two](${imagePublicUrl(two.temporary, BASE)}) D ![one again](${imagePublicUrl(one.temporary, BASE)})`;
		const references = findNoteImageUrls(markdown, BASE);
		const rewritten = rewriteNoteImageUrls(markdown, references, (ref) => {
			const permanent = ref.temporary ? permanentImageKeyForTemporary(ref.key) : null;
			return permanent ? imagePublicUrl(permanent, BASE) : null;
		});
		expect(rewritten).toBe(
			`A ![one](${imagePublicUrl(one.permanent, BASE)}) B ![ext](${external}) C ![two](${imagePublicUrl(two.permanent, BASE)}) D ![one again](${imagePublicUrl(one.permanent, BASE)})`
		);
	});

	it("keeps references whose replacement is null", () => {
		const { temporary } = noteKeys();
		const markdown = `![x](${imagePublicUrl(temporary, BASE)})`;
		expect(rewriteNoteImageUrls(markdown, findNoteImageUrls(markdown, BASE), () => null)).toBe(markdown);
	});

	it("only shortens staged URLs, so the grapheme count cannot grow", () => {
		const { temporary, permanent } = noteKeys();
		const markdown = `![x](${imagePublicUrl(temporary, BASE)})`;
		const rewritten = rewriteNoteImageUrls(markdown, findNoteImageUrls(markdown, BASE), () => imagePublicUrl(permanent, BASE));
		expect(rewritten.length).toBe(markdown.length - "tmp/".length);
	});
});

describe("note editing helpers", () => {
	it("builds unique placeholders and image Markdown", () => {
		expect(noteImagePlaceholder("abc123")).toBe("![Uploading image-abc123]()");
		expect(noteImageMarkdown("dungeon map.png", "https://img/x.webp")).toBe("![dungeon map](https://img/x.webp)");
		expect(noteImageMarkdown("we[ir]d\\name.jpeg", "u")).toBe("![we ir d name](u)");
		expect(noteImageMarkdown(".png", "u")).toBe("![image](u)");
	});

	it("inserts at the caret, or on a new line at the end", () => {
		expect(insertNoteText("Hello world", "[x]", 5)).toEqual({ value: "Hello[x] world", caret: 8 });
		expect(insertNoteText("Hello", "[x]", null)).toEqual({ value: "Hello\n[x]", caret: 9 });
		expect(insertNoteText("Hello\n", "[x]", null)).toEqual({ value: "Hello\n[x]", caret: 9 });
		expect(insertNoteText("", "[x]", null)).toEqual({ value: "[x]", caret: 3 });
		expect(insertNoteText("Hi", "[x]", 99)).toEqual({ value: "Hi\n[x]", caret: 6 });
	});

	it("replaces a placeholder wherever the user moved it, or reports that it is gone", () => {
		const one = noteImagePlaceholder("one");
		const two = noteImagePlaceholder("two");
		const value = `A ${one} B ${two} C`;
		expect(replaceNoteText(value, two, "![b](u2)")).toBe(`A ${one} B ![b](u2) C`);
		expect(replaceNoteText(value, one, "")).toBe(`A  B ${two} C`);
		expect(replaceNoteText("edited away", one, "![a](u)")).toBeNull();
	});
});
