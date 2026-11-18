import { describe, expect, it } from "vitest";
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
	toggleLines
} from "./markdown-format";

describe("toggleInline", () => {
	it("wraps the selection and keeps it selected", () => {
		expect(toggleInline("a word here", 2, 6, "bold")).toEqual({ value: "a **word** here", start: 4, end: 8 });
	});

	it("leaves surrounding whitespace outside the markers", () => {
		expect(toggleInline("a word here", 1, 7, "italic")).toEqual({ value: "a _word_ here", start: 3, end: 7 });
	});

	it("inserts empty markers at a caret", () => {
		expect(toggleInline("ab", 1, 1, "strikethrough")).toEqual({ value: "a~~~~b", start: 3, end: 3 });
	});

	it("unwraps markers around the selection", () => {
		expect(toggleInline("a **word** here", 4, 8, "bold")).toEqual({ value: "a word here", start: 2, end: 6 });
	});

	it("unwraps markers inside the selection", () => {
		expect(toggleInline("a ~~word~~ here", 2, 10, "strikethrough")).toEqual({ value: "a word here", start: 2, end: 6 });
	});

	it("does not treat bold markers as italic", () => {
		expect(toggleInline("**word**", 2, 6, "italic").value).toBe("**_word_**");
	});
});

describe("toggleLines", () => {
	it("adds bullets to each non-blank selected line", () => {
		const value = "one\n\ntwo";
		expect(toggleLines(value, 0, value.length, "unordered")).toEqual({ value: "- one\n\n- two", start: 0, end: 12 });
	});

	it("removes bullets when every line has one", () => {
		const value = "- one\n- two";
		expect(toggleLines(value, 0, value.length, "unordered").value).toBe("one\ntwo");
	});

	it("numbers ordered lists and replaces bullets", () => {
		const value = "- one\n  - two";
		expect(toggleLines(value, 0, value.length, "ordered").value).toBe("1. one\n  2. two");
	});

	it("keeps the caret on its text", () => {
		expect(toggleLines("first\nsecond", 9, 9, "quote")).toEqual({ value: "first\n> second", start: 11, end: 11 });
	});

	it("moves a caret inside a removed prefix to the line start", () => {
		expect(toggleLines("> quote", 1, 1, "quote")).toEqual({ value: "quote", start: 0, end: 0 });
	});

	it("ignores a line the selection only reaches the start of", () => {
		expect(toggleLines("one\ntwo", 0, 4, "quote").value).toBe("> one\ntwo");
	});

	it("prefixes an empty line", () => {
		expect(toggleLines("", 0, 0, "unordered")).toEqual({ value: "- ", start: 2, end: 2 });
	});
});

describe("setHeading", () => {
	it("sets and replaces heading levels", () => {
		expect(setHeading("title", 0, 0, 2)).toEqual({ value: "## title", start: 3, end: 3 });
		expect(setHeading("## title", 5, 5, 4)).toEqual({ value: "#### title", start: 7, end: 7 });
	});

	it("turns a heading into a paragraph", () => {
		expect(setHeading("# title", 4, 4, 0)).toEqual({ value: "title", start: 2, end: 2 });
	});

	it("reads the heading level at a position", () => {
		const value = "text\n### heading";
		expect(headingLevelAt(value, 2)).toBe(0);
		expect(headingLevelAt(value, value.length)).toBe(3);
		expect(headingLevelAt("#hashtag", 0)).toBe(0);
	});
});

describe("block inserts", () => {
	it("inserts a table as its own paragraph after the selection", () => {
		const edit = insertTable("intro", 0, 5);
		expect(edit.value).toBe("intro\n\n| Column 1 | Column 2 |\n| -------- | -------- |\n|          |          |");
		expect(edit.value.slice(edit.start, edit.end)).toBe("Column 1");
	});

	it("wraps the selection in details", () => {
		const edit = insertDetails("before\nhidden\nafter", 7, 13);
		expect(edit.value).toBe("before\n\n<details>\n<summary>Summary</summary>\n\nhidden\n\n</details>\n\nafter");
		expect(edit.value.slice(edit.start, edit.end)).toBe("Summary");
	});
});

describe("links and images", () => {
	it("escapes link text", () => {
		expect(linkMarkdown("a [b]", "https://x.test")).toBe("[a \\[b\\]](https://x.test)");
		expect(imageMarkdown("alt", "https://x.test/a.png")).toBe("![alt](https://x.test/a.png)");
	});

	it("replaces the selection", () => {
		expect(replaceSelection("a b c", 2, 3, "[b](u)")).toEqual({ value: "a [b](u) c", start: 8, end: 8 });
	});

	it("normalizes URLs", () => {
		const web = ["http:", "https:"];
		expect(normalizeUrl(" example.com/a b ", web)).toBe("https://example.com/a%20b");
		expect(normalizeUrl("https://x.test/(1)", web)).toBe("https://x.test/%281%29");
		expect(normalizeUrl("javascript:alert(1)", web)).toBeNull();
		expect(normalizeUrl("mailto:a@b.test", web)).toBeNull();
		expect(normalizeUrl("mailto:a@b.test", [...web, "mailto:"])).toBe("mailto:a@b.test");
		expect(normalizeUrl("", web)).toBeNull();
	});
});
