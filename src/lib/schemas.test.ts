import { v7 } from "uuid";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
	characterLogSchema,
	characterSchema,
	dMLogSchema,
	shortString,
	text,
	type CharacterId,
	type DmLogSchemaIn,
	type LogSchemaIn,
	type LogTarget
} from "./schemas";

/** One grapheme, eleven UTF-16 code units. */
const FAMILY = "👨‍👩‍👧‍👦";

function issueMessages(result: { success: boolean; issues?: readonly { message: string }[] }) {
	return result.success ? [] : (result.issues ?? []).map((issue) => issue.message);
}

function character(overrides: Partial<v.InferInput<typeof characterSchema>> = {}): v.InferInput<typeof characterSchema> {
	return {
		id: v7(),
		name: "Aster",
		campaign: "Forgotten Realms",
		race: "Elf",
		class: "Wizard",
		characterSheetUrl: "",
		imageUrl: "",
		...overrides
	};
}

function dmLogInput(overrides: Partial<DmLogSchemaIn> = {}): DmLogSchemaIn {
	return {
		id: v7(),
		name: "Session",
		date: Date.UTC(2024, 0, 1),
		timezone: "",
		characterId: "",
		characterName: "",
		appliedDate: 0,
		...overrides
	};
}

function logInput(overrides: Partial<LogSchemaIn> = {}): LogSchemaIn {
	return {
		...dmLogInput({ isDmLog: false }),
		dm: { id: "", name: "", DCI: "", userId: v7(), isUser: false },
		...overrides
	};
}

function target(overrides: Partial<LogTarget> = {}): LogTarget {
	return { id: v7() as CharacterId, totalLevel: 1, totalGold: 0, totalTcp: 0, logs: [], ...overrides };
}

describe("grapheme limits", () => {
	it("counts an emoji sequence as one grapheme", () => {
		expect(FAMILY.length).toBeGreaterThan(1);
		expect(v.safeParse(shortString, FAMILY.repeat(64)).success).toBe(true);
	});

	it("allows 64 graphemes and rejects 65 in a short string", () => {
		expect(v.safeParse(shortString, "A".repeat(64)).success).toBe(true);
		expect(issueMessages(v.safeParse(shortString, "A".repeat(65)))).toEqual([expect.stringMatching(/graphemes/i)]);
	});

	it("allows 2000 graphemes and rejects 2001 in text", () => {
		expect(v.safeParse(text, FAMILY.repeat(2000)).success).toBe(true);
		expect(v.safeParse(text, FAMILY.repeat(2001)).success).toBe(false);
	});

	it("applies the limit to an emoji-heavy character name", () => {
		expect(v.safeParse(characterSchema, character({ name: `A${FAMILY.repeat(63)}` })).success).toBe(true);
		const tooLong = v.safeParse(characterSchema, character({ name: `A${FAMILY.repeat(64)}` }));
		expect(issueMessages(tooLong)).toEqual([expect.stringMatching(/graphemes/i)]);
	});

	it("applies the limit to an emoji-heavy log title", () => {
		expect(v.safeParse(characterLogSchema(target()), logInput({ name: `A${FAMILY.repeat(63)}` })).success).toBe(true);
		expect(v.safeParse(characterLogSchema(target()), logInput({ name: `A${FAMILY.repeat(64)}` })).success).toBe(false);
	});

	it("measures the limit after trimming", () => {
		const result = v.safeParse(shortString, `  ${"A".repeat(64)}  `);
		expect(result.success && result.output).toBe("A".repeat(64));
	});
});

describe("required strings", () => {
	it.each(["", "   ", "🐉🐉", "!!!"])("rejects %j as a character name", (name) => {
		expect(issueMessages(v.safeParse(characterSchema, character({ name })))).toEqual(["Required"]);
	});

	it("rejects an empty log title", () => {
		expect(issueMessages(v.safeParse(characterLogSchema(target()), logInput({ name: " " })))).toEqual(["Required"]);
	});
});

describe("characterLogSchema", () => {
	it("allows reaching level 20 and rejects going past it", () => {
		expect(v.safeParse(characterLogSchema(target()), logInput({ level: 19 })).success).toBe(true);
		expect(issueMessages(v.safeParse(characterLogSchema(target()), logInput({ level: 20 })))).toEqual([
			"Cannot increase level above 20. Current: 1"
		]);
	});

	it("rejects spending more gold than the character has", () => {
		const result = v.safeParse(characterLogSchema(target({ totalGold: 10 })), logInput({ gold: -11 }));
		expect(issueMessages(result)).toEqual([expect.stringMatching(/total gold to less than 0/)]);
	});

	it("rejects dropping an item the character never gained", () => {
		const result = v.safeParse(characterLogSchema(target()), logInput({ magicItemsLost: [v7()] }));
		expect(issueMessages(result)).toEqual(["Can't drop an item before it was acquired"]);
	});
});

describe("dMLogSchema", () => {
	const assigned = (characterId: string) => dmLogInput({ characterId, appliedDate: Date.UTC(2024, 0, 2) });

	it("accepts a character the user owns", () => {
		const owned = target();
		expect(v.safeParse(dMLogSchema([owned]), assigned(owned.id)).success).toBe(true);
	});

	it("rejects a character the user does not own", () => {
		expect(issueMessages(v.safeParse(dMLogSchema([target()]), assigned(v7())))).toEqual(["Character not found"]);
	});

	it("rejects any assigned character when the user owns none", () => {
		expect(issueMessages(v.safeParse(dMLogSchema([]), assigned(v7())))).toEqual(["Character not found"]);
	});

	it("rejects going past level 20 on the assigned character", () => {
		const owned = target({ totalLevel: 20 });
		const result = v.safeParse(dMLogSchema([owned]), { ...assigned(owned.id), level: 1 });
		expect(issueMessages(result)).toEqual(["Cannot increase level above 20"]);
	});
});
