import { imagePublicUrl, permanentNoteImageKey, temporaryNoteImageKey } from "#lib/images/object-key.js";
import type { DungeonMasterId, ItemId, UserId } from "#lib/schemas.js";
import { logDraftSchema } from "#lib/schemas.js";
import { v7 } from "uuid";
import { describe, expect, it } from "vitest";
import * as v from "valibot";
import {
	applyDraftToDmLog,
	applyDraftToLog,
	draftDescriptionHasNewImages,
	logToDraftData,
	matchDraftDm,
	type CharacterDraftFillTarget,
	type DraftFillTarget,
	type OwnedDm
} from "./log-draft";

const publicBase = "https://images.example.test";
const userId = v7() as UserId;
const otherUserId = v7() as UserId;

function dm(overrides: Partial<OwnedDm> = {}): OwnedDm {
	return {
		id: v7() as DungeonMasterId,
		name: "Ada",
		DCI: "",
		userId,
		isUser: false,
		...overrides
	};
}

function draftInput(overrides: Record<string, unknown> = {}) {
	return {
		id: "",
		name: "Candlekeep",
		date: Date.UTC(2024, 5, 1, 18),
		timezone: "UTC",
		type: "game" as const,
		experience: 0,
		acp: 0,
		tcp: 0,
		level: 1,
		gold: 50,
		dtd: 0,
		description: "Notes",
		dm: { name: "Ada", DCI: "123" },
		magicItemsGained: [],
		storyAwardsGained: [],
		...overrides
	};
}

function target(): CharacterDraftFillTarget {
	return {
		id: v7(),
		name: "",
		date: Date.UTC(2026, 0, 2),
		timezone: "UTC",
		type: "game",
		experience: 0,
		acp: 0,
		tcp: 0,
		level: 0,
		gold: 0,
		dtd: 0,
		description: "",
		dm: dm({ name: "" }),
		magicItemsGained: [],
		storyAwardsGained: []
	};
}

describe("log draft schema", () => {
	it("accepts a draft and stores an empty date as null", () => {
		const parsed = v.parse(logDraftSchema, draftInput({ date: 0 }));
		expect(parsed.date).toBeNull();
		expect(parsed.name).toBe("Candlekeep");
	});

	it("rejects a title past the log name limit", () => {
		expect(v.safeParse(logDraftSchema, draftInput({ name: "A".repeat(65) })).success).toBe(false);
		expect(v.safeParse(logDraftSchema, draftInput({ name: "A".repeat(64) })).success).toBe(true);
	});

	it("rejects a date before 2014", () => {
		expect(v.safeParse(logDraftSchema, draftInput({ date: Date.UTC(2013, 11, 31) })).success).toBe(false);
	});

	it("rejects notes past the log notes limit", () => {
		expect(v.safeParse(logDraftSchema, draftInput({ description: "A".repeat(5001) })).success).toBe(false);
	});

	it("treats a draft without a kind as a character draft", () => {
		expect(v.parse(logDraftSchema, draftInput()).kind).toBe("character");
		expect(v.parse(logDraftSchema, draftInput({ kind: "dm" })).kind).toBe("dm");
		expect(v.safeParse(logDraftSchema, draftInput({ kind: "other" })).success).toBe(false);
	});
});

describe("logToDraftData", () => {
	const saved = {
		name: "Session",
		timezone: "UTC",
		type: "game" as const,
		experience: 0,
		acp: 0,
		tcp: 0,
		level: 1,
		gold: 0,
		dtd: 0,
		description: "",
		dm: { name: "Ada", DCI: "" },
		magicItemsGained: [],
		storyAwardsGained: []
	};

	it("marks a copied DM log as a DM draft and a character log as a character draft", () => {
		expect(logToDraftData({ ...saved, isDmLog: true }).kind).toBe("dm");
		expect(logToDraftData({ ...saved, isDmLog: false }).kind).toBe("character");
	});
});

describe("applyDraftToDmLog", () => {
	it("fills the shared fields, keeps the log id, and remints items", () => {
		const log: DraftFillTarget = {
			id: v7(),
			name: "",
			date: Date.UTC(2026, 0, 2),
			timezone: "UTC",
			magicItemsGained: [],
			storyAwardsGained: []
		};
		const logId = log.id;
		const itemId = v7() as ItemId;
		const draft = logToDraftData({
			isDmLog: true,
			name: "Hosted",
			timezone: "UTC",
			type: "game",
			experience: 0,
			acp: 4,
			tcp: 2,
			level: 0,
			gold: 75,
			dtd: 10,
			description: "Ran it",
			dm: { name: "Me", DCI: "" },
			magicItemsGained: [],
			storyAwardsGained: [{ id: itemId, name: "Award", description: "" }]
		});

		applyDraftToDmLog(log, draft);

		expect(log.id).toBe(logId);
		expect(log.date).toBe(Date.UTC(2026, 0, 2));
		expect(log).toMatchObject({ name: "Hosted", acp: 4, tcp: 2, gold: 75, dtd: 10, description: "Ran it" });
		expect(log.storyAwardsGained?.[0]?.name).toBe("Award");
		expect(log.storyAwardsGained?.[0]?.id).not.toBe(itemId);
		expect(log).not.toHaveProperty("dm");
		expect(log).not.toHaveProperty("type");
	});
});

describe("matchDraftDm", () => {
	const player = userId;
	const byDci = dm({ name: "Robert", DCI: "999" });
	const byName = dm({ name: "Ada Wren", DCI: "111" });

	it("matches DCI before name", () => {
		const matched = matchDraftDm([byName, byDci], { name: "Ada Wren", DCI: "999" }, player);
		expect(matched.id).toBe(byDci.id);
		expect(matched.name).toBe("Robert");
	});

	it("matches a trimmed case-insensitive name when DCI is new", () => {
		const matched = matchDraftDm([byName, byDci], { name: "  ada wren ", DCI: "000" }, player);
		expect(matched.id).toBe(byName.id);
	});

	it("does not treat a blank DCI as a match", () => {
		const blank = dm({ name: "Someone", DCI: "" });
		const matched = matchDraftDm([blank], { name: "New DM", DCI: "  " }, player);
		expect(matched.id).not.toBe(blank.id);
		expect(matched.isUser).toBe(false);
		expect(matched.userId).toBe(player);
		expect(matched.name).toBe("New DM");
		expect(matched.DCI).toBe("");
	});
});

describe("applyDraftToLog", () => {
	it("keeps the log id and date when the draft has no date, and remints items", () => {
		const log = target();
		const logId = log.id;
		const itemId = v7() as ItemId;
		const draft = logToDraftData({
			isDmLog: false,
			name: "Shared",
			timezone: "UTC",
			type: "game",
			experience: 100,
			acp: 0,
			tcp: 1,
			level: 0,
			gold: 10,
			dtd: 2,
			description: "Keep",
			dm: { name: "Ada", DCI: "" },
			magicItemsGained: [{ id: itemId, name: "Ring", description: "" }],
			storyAwardsGained: []
		});
		expect(draft.date).toBeNull();

		const known = dm({ name: "Ada", DCI: "" });
		applyDraftToLog(log, draft, [known], userId);

		expect(log.id).toBe(logId);
		expect(log.date).toBe(Date.UTC(2026, 0, 2));
		expect(log.name).toBe("Shared");
		expect(log.experience).toBe(100);
		expect(log.dm.id).toBe(known.id);
		expect(log.magicItemsGained?.[0]?.name).toBe("Ring");
		expect(log.magicItemsGained?.[0]?.id).not.toBe(itemId);
	});

	it("uses the draft date when the draft has one", () => {
		const log = target();
		const when = Date.UTC(2024, 3, 4);
		const draft = logToDraftData({
			isDmLog: false,
			name: "Dated",
			timezone: "UTC",
			type: "game",
			experience: 0,
			acp: 0,
			tcp: 0,
			level: 0,
			gold: 0,
			dtd: 0,
			description: "",
			dm: { name: "New", DCI: "5" },
			magicItemsGained: [],
			storyAwardsGained: []
		});
		applyDraftToLog(log, { ...draft, date: when }, [], otherUserId);
		expect(log.date).toBe(when);
		expect(log.dm.userId).toBe(otherUserId);
		expect(log.dm.isUser).toBe(false);
	});

	it("does not carry a DM onto a non-game log", () => {
		const log = target();
		const known = dm({ name: "Ada", DCI: "123" });
		const draft = logToDraftData({
			isDmLog: false,
			name: "Shopping",
			timezone: "UTC",
			type: "nongame",
			experience: 0,
			acp: 0,
			tcp: 0,
			level: 0,
			gold: -50,
			dtd: 0,
			description: "",
			dm: { name: "Ada", DCI: "123" },
			magicItemsGained: [],
			storyAwardsGained: []
		});
		applyDraftToLog(log, draft, [known], userId);
		expect(log.type).toBe("nongame");
		expect(log.dm.id).not.toBe(known.id);
		expect(log.dm.name).toBe("");
		expect(log.dm.DCI).toBe("");
	});
});

describe("draft images", () => {
	it("flags a staged note image and ignores a permanent one", () => {
		const upload = v7();
		const temporary = temporaryNoteImageKey(userId, upload, "image/webp");
		const permanent = permanentNoteImageKey(userId, upload, "image/webp");
		const temporaryUrl = imagePublicUrl(temporary, publicBase);
		const permanentUrl = imagePublicUrl(permanent, publicBase);
		expect(draftDescriptionHasNewImages(`See ![map](${temporaryUrl})`, publicBase)).toBe(true);
		expect(draftDescriptionHasNewImages(`See ![map](${permanentUrl})`, publicBase)).toBe(false);
	});
});
