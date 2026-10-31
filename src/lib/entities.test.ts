import { v7 } from "uuid";
import { describe, expect, it } from "vitest";
import {
	alreadyDropped,
	dropBeforeAcquisition,
	gainAfterDrop,
	itemTimelineIssues,
	logIsBefore,
	type ItemTimelineIssue,
	type TimelineLog
} from "./entities";
import type { ItemId, LogId } from "./schemas";

const day = (n: number) => new Date(Date.UTC(2024, 0, n));
const itemId = () => v7() as ItemId;
const logId = () => v7() as LogId;

function log(date: Date, items: { id?: LogId; gained?: ItemId[]; lost?: ItemId[]; awards?: ItemId[] } = {}): TimelineLog {
	return {
		id: items.id ?? logId(),
		date,
		isDmLog: false,
		appliedDate: null,
		magicItemsGained: (items.gained ?? []).map((id) => ({ id })),
		magicItemsLost: (items.lost ?? []).map((id) => ({ id })),
		storyAwardsGained: (items.awards ?? []).map((id) => ({ id })),
		storyAwardsLost: []
	};
}

function input(
	date: Date,
	items: { id?: LogId; gained?: ItemId[]; lost?: ItemId[]; lostAwards?: ItemId[] } = {},
	dm?: { appliedDate: Date | null }
) {
	return {
		id: items.id ?? logId(),
		date,
		isDmLog: !!dm,
		appliedDate: dm?.appliedDate ?? null,
		magicItemsGained: (items.gained ?? []).map((id) => ({ id })),
		magicItemsLost: items.lost ?? [],
		storyAwardsGained: [],
		storyAwardsLost: items.lostAwards ?? []
	};
}

function messages(issues: ItemTimelineIssue[]) {
	return issues.map(({ field, message }) => ({ field, message }));
}

describe("logIsBefore", () => {
	it("orders logs with the same timestamp by uuid creation order", () => {
		const first = { id: "01a1928a-e1db-7622-b55b-02da10ae134d", time: 1 };
		const second = { id: "01a1928a-e1db-7622-b55b-0bcdd08f7aa9", time: 1 };
		expect(logIsBefore(first, second)).toBe(true);
		expect(logIsBefore(second, first)).toBe(false);
		expect(logIsBefore({ ...second, time: 0 }, first)).toBe(true);
	});
});

describe("itemTimelineIssues", () => {
	it("allows dropping an item that is held at the log's date", () => {
		const cloak = itemId();
		const logs = [log(day(1), { gained: [cloak] })];
		expect(itemTimelineIssues(logs, input(day(2), { lost: [cloak] }))).toEqual([]);
	});

	it("rejects a backdated log that drops an item acquired later", () => {
		const cloak = itemId();
		const logs = [log(day(10), { gained: [cloak] })];
		expect(messages(itemTimelineIssues(logs, input(day(5), { lost: [cloak] })))).toEqual([
			{ field: "magicItemsLost", message: dropBeforeAcquisition }
		]);
	});

	it("rejects dropping the same item twice", () => {
		const cloak = itemId();
		const logs = [log(day(1), { gained: [cloak] }), log(day(2), { lost: [cloak] })];
		expect(messages(itemTimelineIssues(logs, input(day(3), { lost: [cloak] })))).toEqual([
			{ field: "magicItemsLost", message: alreadyDropped }
		]);
	});

	it("rejects moving the gain log after the log that drops the item", () => {
		const cloak = itemId();
		const gain = log(day(1), { gained: [cloak] });
		const drop = log(day(5), { lost: [cloak] });
		const moved = input(day(9), { id: gain.id, gained: [cloak] });
		expect(messages(itemTimelineIssues([gain, drop], moved))).toEqual([{ field: "date", message: gainAfterDrop }]);
	});

	it("allows moving the gain log earlier", () => {
		const cloak = itemId();
		const gain = log(day(3), { gained: [cloak] });
		const drop = log(day(5), { lost: [cloak] });
		expect(itemTimelineIssues([gain, drop], input(day(1), { id: gain.id, gained: [cloak] }))).toEqual([]);
	});

	it("rejects dropping an item in the same log that gains it", () => {
		const cloak = itemId();
		expect(messages(itemTimelineIssues([], input(day(1), { gained: [cloak], lost: [cloak] })))).toEqual([
			{ field: "magicItemsLost", message: dropBeforeAcquisition }
		]);
	});

	it("breaks a timestamp tie by uuid creation order", () => {
		// Numeric collation puts "...-0bcd..." first. Creation order puts "...-02da..." first.
		const gainId = "01a1928a-e1db-7622-b55b-02da10ae134d" as LogId;
		const laterId = "01a1928a-e1db-7622-b55b-0bcdd08f7aa9" as LogId;
		const earlierId = "01a1928a-e1db-7622-b55b-0000d08f7aa9" as LogId;
		const cloak = itemId();
		const gain = log(day(1), { id: gainId, gained: [cloak] });

		expect(itemTimelineIssues([gain], input(day(1), { id: laterId, lost: [cloak] }))).toEqual([]);
		expect(messages(itemTimelineIssues([gain], input(day(1), { id: earlierId, lost: [cloak] })))).toEqual([
			{ field: "magicItemsLost", message: dropBeforeAcquisition }
		]);
	});

	it("dates an assigned DM log by its applied date", () => {
		const cloak = itemId();
		const logs = [log(day(10), { gained: [cloak] })];
		expect(messages(itemTimelineIssues(logs, input(day(20), { lost: [cloak] }, { appliedDate: day(5) })))).toEqual([
			{ field: "magicItemsLost", message: dropBeforeAcquisition }
		]);
		expect(itemTimelineIssues(logs, input(day(5), { lost: [cloak] }, { appliedDate: day(20) }))).toEqual([]);
	});

	it("does not let a story award be dropped as a magic item", () => {
		const award = itemId();
		const logs = [log(day(1), { awards: [award] })];
		expect(messages(itemTimelineIssues(logs, input(day(2), { lost: [award] })))).toEqual([
			{ field: "magicItemsLost", message: dropBeforeAcquisition }
		]);
		expect(itemTimelineIssues(logs, input(day(2), { lostAwards: [award] }))).toEqual([]);
	});

	it("ignores the saved copy of the log being edited", () => {
		const cloak = itemId();
		const gain = log(day(1), { gained: [cloak] });
		const drop = log(day(2), { lost: [cloak] });
		expect(itemTimelineIssues([gain, drop], input(day(3), { id: drop.id, lost: [cloak] }))).toEqual([]);
	});
});
