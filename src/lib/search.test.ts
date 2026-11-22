import type { ItemId, LogId } from "#lib/schemas.js";
import { v7 } from "uuid";
import { describe, expect, it } from "vitest";
import {
	buildLogSearchIndex,
	consolidateItems,
	getPageSearchValue,
	matchIndexedEntity,
	tokenizeSearchQuery,
	type SearchableLog
} from "./search";

const logId = () => v7() as LogId;
const itemId = () => v7() as ItemId;

function makeItem(name: string, options: { logGainedId?: LogId; description?: string | null } = {}) {
	return {
		id: itemId(),
		name,
		description: options.description ?? null,
		logGainedId: options.logGainedId ?? logId()
	};
}

function makeLog(
	name: string,
	options: {
		id?: LogId;
		gained?: string[];
		lost?: string[];
		awardsGained?: string[];
		awardsLost?: string[];
	} = {}
): SearchableLog {
	return {
		id: options.id ?? logId(),
		name,
		character: null,
		dm: { name: "DM" },
		magicItemsGained: (options.gained ?? []).map((itemName) => ({ name: itemName })),
		magicItemsLost: (options.lost ?? []).map((itemName) => ({ name: itemName })),
		storyAwardsGained: (options.awardsGained ?? []).map((awardName) => ({ name: awardName })),
		storyAwardsLost: (options.awardsLost ?? []).map((awardName) => ({ name: awardName }))
	};
}

function filterLogs(logs: SearchableLog[], query: string) {
	const tokens = tokenizeSearchQuery(query);
	if (!tokens.length) return logs;
	return logs.filter((log) => matchIndexedEntity(buildLogSearchIndex(log).index, tokens) !== null);
}

describe("consolidateItems", () => {
	it("merges duplicate consumables, pluralizes display name, and keeps singular searchName", () => {
		const log1 = logId();
		const log2 = logId();
		const first = makeItem("Potion of Healing", { logGainedId: log1 });
		const second = makeItem("Potion of Healing", { logGainedId: log2 });

		const result = consolidateItems([first, second]);

		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("2× Potions of Healing");
		expect(result[0]?.searchName).toBe("Potion of Healing");
		expect(result[0]?.quantity).toBe(2);
		expect(result[0]?.ids).toEqual([log1, log2]);
	});

	it("sums quantities accurately across three or more merged consumables", () => {
		const items = [makeItem("Potion of Healing"), makeItem("Potion of Healing"), makeItem("Potion of Healing")];

		const result = consolidateItems(items);

		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("3× Potions of Healing");
		expect(result[0]?.searchName).toBe("Potion of Healing");
		expect(result[0]?.quantity).toBe(3);
	});

	it("normalizes quantity-prefixed and pluralized source names into the singular searchName", () => {
		const items = [makeItem("2x Potions of Healing"), makeItem("Potion of Healing")];

		const result = consolidateItems(items);

		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("3× Potions of Healing");
		expect(result[0]?.searchName).toBe("Potion of Healing");
		expect(result[0]?.quantity).toBe(3);
	});

	it("merges Spell Scroll and Scroll variants under a shared base searchName", () => {
		const items = [makeItem("Spell Scroll of Fireball"), makeItem("Scroll of Fireball")];

		const result = consolidateItems(items);

		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("2× Scrolls of Fireball");
		expect(result[0]?.searchName).toBe("Scroll of Fireball");
	});

	it("does not mutate the source item objects", () => {
		const first = makeItem("Potion of Healing");
		const second = makeItem("Potion of Healing");
		const scroll = makeItem("Spell Scroll of Fireball");

		consolidateItems([first, second, scroll]);

		expect(first.name).toBe("Potion of Healing");
		expect(second.name).toBe("Potion of Healing");
		expect(scroll.name).toBe("Spell Scroll of Fireball");
	});

	it("merges non-consumables without pluralizing them", () => {
		const items = [makeItem("Bag of Holding"), makeItem("Bag of Holding")];

		const result = consolidateItems(items);

		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("2× Bag of Holding");
		expect(result[0]?.searchName).toBe("Bag of Holding");
	});

	it("leaves story award names untouched even with leading numbers", () => {
		const items = [makeItem("2nd Place Champion"), makeItem("Hero of Phlan")];

		const result = consolidateItems(items, { isStoryAward: true });

		expect(result.map((item) => ({ name: item.name, searchName: item.searchName }))).toEqual([
			{ name: "2nd Place Champion", searchName: "2nd Place Champion" },
			{ name: "Hero of Phlan", searchName: "Hero of Phlan" }
		]);
	});

	it("keeps items with distinct descriptions separate while preserving searchName", () => {
		const items = [
			makeItem("Potion of Healing", { description: "Red vial" }),
			makeItem("Potion of Healing", { description: "Blue vial" })
		];

		const result = consolidateItems(items);

		expect(result).toHaveLength(2);
		expect(result.every((item) => item.searchName === "Potion of Healing")).toBe(true);
	});
});

describe("log search by item name", () => {
	it("matches every log that contributed a merged item using its base singular searchName", () => {
		const log1 = makeLog("Session 1", { gained: ["Potion of Healing"] });
		const log2 = makeLog("Session 2", { gained: ["2x Potions of Healing"] });
		const log3 = makeLog("Session 3", { gained: ["Cloak of Protection"] });

		const [consolidated] = consolidateItems([
			makeItem("Potion of Healing", { logGainedId: log1.id }),
			makeItem("2x Potions of Healing", { logGainedId: log2.id })
		]);

		expect(consolidated?.name).toBe("3× Potions of Healing");
		expect(consolidated?.searchName).toBe("Potion of Healing");

		const matched = filterLogs([log1, log2, log3], consolidated!.searchName);
		expect(matched.map((log) => log.name)).toEqual(["Session 1", "Session 2"]);
	});

	it("matches logs containing Spell Scroll and Scroll variants when filtering by Scroll searchName", () => {
		const log1 = makeLog("Session 1", { gained: ["Spell Scroll of Fireball"] });
		const log2 = makeLog("Session 2", { gained: ["Scroll of Fireball"] });
		const log3 = makeLog("Session 3", { gained: ["Scroll of Identify"] });

		const [consolidated] = consolidateItems([
			makeItem("Spell Scroll of Fireball", { logGainedId: log1.id }),
			makeItem("Scroll of Fireball", { logGainedId: log2.id })
		]);

		const matched = filterLogs([log1, log2, log3], consolidated!.searchName);
		expect(matched.map((log) => log.name)).toEqual(["Session 1", "Session 2"]);
	});

	it("does not match logs that only partially match across multiple unrelated items", () => {
		const matchingLog = makeLog("Session 1", { gained: ["Potion of Healing"] });
		const twoOtherPotions = makeLog("Session 2", { gained: ["Potion of Climbing", "Potion of Fire Breath"] });
		const oneOtherPotion = makeLog("Session 3", { gained: ["Potion of Climbing"] });

		const matched = filterLogs([matchingLog, twoOtherPotions, oneOtherPotion], "Potion of Healing");
		expect(matched.map((log) => log.name)).toEqual(["Session 1"]);
	});

	it("matches logs that gained or lost the searched magic item or story award", () => {
		const gainLog = makeLog("Session 1", { gained: ["Cloak of Protection"] });
		const dropLog = makeLog("Session 2", { lost: ["Cloak of Protection"] });
		const awardLog = makeLog("Session 3", { awardsGained: ["Hero of Phlan"] });
		const otherLog = makeLog("Session 4", { gained: ["Bag of Holding"] });

		expect(filterLogs([gainLog, dropLog, awardLog, otherLog], "Cloak of Protection").map((l) => l.name)).toEqual([
			"Session 1",
			"Session 2"
		]);
		expect(filterLogs([gainLog, dropLog, awardLog, otherLog], "Hero of Phlan").map((l) => l.name)).toEqual(["Session 3"]);
	});

	it("matches items with punctuation and modifiers", () => {
		const logs = [
			makeLog("Session 1", { gained: ["Alchemist's Fire"] }),
			makeLog("Session 2", { gained: ["+1 Shield"] }),
			makeLog("Session 3", { gained: ["Ioun Stone (Protection)"] })
		];

		expect(filterLogs(logs, "Alchemist's Fire").map((l) => l.name)).toEqual(["Session 1"]);
		expect(filterLogs(logs, "+1 Shield").map((l) => l.name)).toEqual(["Session 2"]);
		expect(filterLogs(logs, "Ioun Stone (Protection)").map((l) => l.name)).toEqual(["Session 3"]);
	});

	it("returns all logs when the query is cleared", () => {
		const logs = [makeLog("Session 1", { gained: ["Potion of Healing"] }), makeLog("Session 2")];

		expect(filterLogs(logs, "")).toHaveLength(2);
	});
});

describe("getPageSearchValue", () => {
	it("reads the search param from page.url on initial load", () => {
		const value = getPageSearchValue(
			{
				url: new URL("https://example.com/characters/123?s=Potion+of+Healing"),
				shallow: null,
				state: {}
			},
			"s"
		);

		expect(value).toBe("Potion of Healing");
	});

	it("prefers page.state.search over stale page.url, including when cleared to empty string", () => {
		const value = getPageSearchValue(
			{
				url: new URL("https://example.com/characters/123?s=Potion+of+Healing"),
				shallow: { url: new URL("https://example.com/characters/123") },
				state: { search: { s: "" } }
			},
			"s"
		);

		expect(value).toBe("");
	});

	it("falls back to page.shallow.url when state.search is absent", () => {
		const value = getPageSearchValue(
			{
				url: new URL("https://example.com/characters/123"),
				shallow: { url: new URL("https://example.com/characters/123?s=Cloak+of+Protection") },
				state: {}
			},
			"s"
		);

		expect(value).toBe("Cloak of Protection");
	});

	it("returns empty string when neither state nor URL sets the search param", () => {
		const value = getPageSearchValue(
			{
				url: new URL("https://example.com/characters/123"),
				shallow: null,
				state: {}
			},
			"s"
		);

		expect(value).toBe("");
	});
});
