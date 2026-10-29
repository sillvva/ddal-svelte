import type { DungeonMaster, Log, MagicItem, StoryAward } from "#lib/server/db/schema.js";
import type { CharacterData, FullCharacterData } from "#lib/server/effect/services/characters.js";
import type { ExtendedLogData, FullLogData, LogData, LogSummaryData } from "#lib/server/effect/services/logs.js";
import { omit, sorter } from "@sillvva/utils";
import { v7 } from "uuid";
import { BLANK_CHARACTER, PlaceholderName } from "./constants";
import {
	type CharacterId,
	type DungeonMasterId,
	type LocalsUser,
	type LogId,
	type LogSchema,
	type UserId
} from "./schemas";

/** Date this log applies to the character. Assigned DM logs use their applied date. */
export function logTimelineTime(log: {
	showDate?: Date | string | number | null;
	isDmLog?: boolean;
	appliedDate?: Date | string | number | null;
	date: Date | string | number;
}) {
	const value = log.showDate ?? (log.isDmLog && log.appliedDate ? log.appliedDate : log.date);
	return new Date(value).getTime();
}

/**
 * Same timestamp: the lower log id comes first. Uuid v7 ids increase with creation time,
 * so a newly minted log sorts after existing logs that share its timestamp.
 */
export function logIsBefore(candidate: { id: string; time: number }, current: { id: string; time: number }) {
	const byTime = sorter(candidate.time, current.time);
	if (byTime !== 0) return byTime < 0;
	return sorter(candidate.id, current.id) < 0;
}

export function getItemEntities(
	character: Pick<FullCharacterData, "logs">,
	options?: {
		/** Log being edited or created. Its own gains and drops are not inventory yet. */
		logId?: string;
		/** Timeline date of that log. Later logs are excluded. */
		asOf?: Date | number | string;
		excludeDropped?: boolean;
	}
) {
	const { logId = "", asOf, excludeDropped = false } = options || {};
	const currentTime = asOf === undefined || asOf === "" ? undefined : new Date(asOf).getTime();
	const current = logId && currentTime !== undefined && !Number.isNaN(currentTime) ? { id: logId, time: currentTime } : undefined;

	let magicItems: MagicItem[] = [];
	let storyAwards: StoryAward[] = [];

	const logs = character.logs
		.filter((log) => log.id !== logId)
		.filter((log) => !current || logIsBefore({ id: log.id, time: logTimelineTime(log) }, current))
		.toSorted((a, b) => sorter(logTimelineTime(a), logTimelineTime(b)) || sorter(a.id, b.id));

	for (const log of logs) {
		magicItems.push(...log.magicItemsGained);
		storyAwards.push(...log.storyAwardsGained);
		if (excludeDropped) {
			const lostItems = new Set(log.magicItemsLost.map((item) => item.id));
			const lostAwards = new Set(log.storyAwardsLost.map((item) => item.id));
			magicItems = magicItems.filter((item) => !lostItems.has(item.id));
			storyAwards = storyAwards.filter((item) => !lostAwards.has(item.id));
		}
	}

	return {
		magicItems: magicItems.toSorted((a, b) => sorter(a.name, b.name)),
		storyAwards: storyAwards.toSorted((a, b) => sorter(a.name, b.name))
	};
}

export type ItemTimelineIssue = {
	field: "magicItemsLost" | "storyAwardsLost" | "date";
	message: string;
};

const dropBeforeAcquisition = "Can't drop an item before it was acquired";
const alreadyDropped = "This item was already dropped in an earlier log";
const gainAfterDrop = "An item gained in this log is dropped in an earlier log";

/** Reject a drop dated before the item was acquired, including after the log's date moves. */
export function itemTimelineIssues(
	logs: FullCharacterData["logs"],
	input: {
		id: string;
		isDmLog?: boolean;
		date: Date;
		appliedDate?: Date | null;
		magicItemsGained: readonly { id: string }[];
		magicItemsLost: readonly string[];
		storyAwardsGained: readonly { id: string }[];
		storyAwardsLost: readonly string[];
	}
): ItemTimelineIssue[] {
	const inputTime = input.isDmLog ? (input.appliedDate ?? input.date).getTime() : input.date.getTime();
	const events: {
		id: string;
		time: number;
		magicGained: string[];
		magicLost: string[];
		storyGained: string[];
		storyLost: string[];
	}[] = logs
		.filter((log) => log.id !== input.id)
		.map((log) => ({
			id: log.id,
			time: logTimelineTime(log),
			magicGained: log.magicItemsGained.map((item) => item.id),
			magicLost: log.magicItemsLost.map((item) => item.id),
			storyGained: log.storyAwardsGained.map((item) => item.id),
			storyLost: log.storyAwardsLost.map((item) => item.id)
		}));

	events.push({
		id: input.id,
		time: inputTime,
		magicGained: input.magicItemsGained.map((item) => item.id),
		magicLost: [...input.magicItemsLost],
		storyGained: input.storyAwardsGained.map((item) => item.id),
		storyLost: [...input.storyAwardsLost]
	});
	events.sort((a, b) => sorter(a.time, b.time) || sorter(a.id, b.id));

	const gained = new Map<string, "magic" | "story">();
	const held = new Set<string>();
	const issues: ItemTimelineIssue[] = [];
	const seen = new Set<string>();
	const add = (issue: ItemTimelineIssue) => {
		const key = `${issue.field}:${issue.message}`;
		if (seen.has(key)) return;
		seen.add(key);
		issues.push(issue);
	};

	const noteDrop = (
		id: string,
		kind: "magic" | "story",
		isInput: boolean,
		inputGained: readonly { id: string }[],
		field: "magicItemsLost" | "storyAwardsLost"
	) => {
		if (gained.get(id) !== kind) {
			if (isInput) add({ field, message: dropBeforeAcquisition });
			else if (inputGained.some((item) => item.id === id)) add({ field: "date", message: gainAfterDrop });
			return;
		}
		if (!held.has(id)) {
			if (isInput) add({ field, message: alreadyDropped });
			return;
		}
		held.delete(id);
	};

	for (const event of events) {
		const isInput = event.id === input.id;
		for (const id of event.magicLost) noteDrop(id, "magic", isInput, input.magicItemsGained, "magicItemsLost");
		for (const id of event.storyLost) noteDrop(id, "story", isInput, input.storyAwardsGained, "storyAwardsLost");
		for (const id of event.magicGained) {
			gained.set(id, "magic");
			held.add(id);
		}
		for (const id of event.storyGained) {
			gained.set(id, "story");
			held.add(id);
		}
	}

	return issues;
}

export type LogLevel = { id: LogId; levels: number };

export function getLevels(
	logs: Log[],
	base: { level?: number; experience?: number; acp?: number } = { level: 0, experience: 0, acp: 0 }
) {
	let totalLevel = Math.max(1, base.level || 0);
	const logLevels: LogLevel[] = [];

	const xpLevels = [
		0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000,
		305000, 355000
	];
	const acpLevels = [0, 4, 8, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92, 100, 108, 116, 124, 132, 140];

	let totalXp = base.experience || 0;
	let totalAcp = base.acp || 0;
	let xpNext = 1;
	let acpNext = totalLevel;

	logs.forEach((log) => {
		totalXp += log.experience;
		totalAcp += log.acp;
		let gainedXp = 0;
		let gainedAcp = 0;

		while (xpLevels[xpNext] && totalXp >= xpLevels[xpNext]!) {
			gainedXp++;
			xpNext++;
		}

		while (acpLevels[acpNext] && totalAcp >= acpLevels[acpNext]!) {
			gainedAcp++;
			acpNext++;
		}

		const gainedLevels = Math.max(gainedXp, gainedAcp, log.level);
		if (gainedLevels > 0) {
			logLevels.push({ id: log.id, levels: gainedLevels });
			totalLevel += gainedLevels;
		}
	});

	return {
		total: Math.min(20, totalLevel),
		logLevels
	};
}

export function getLogsSummary(logs: LogData[]) {
	const sortedLogs = logs.map(parseLog).toSorted((a, b) => sorter(a.showDate, b.showDate));

	const levels = getLevels(sortedLogs);
	const totalLevel = levels.total;
	const totalGold = sortedLogs.reduce((acc, log) => acc + log.gold, 0);
	const totalTcp = sortedLogs.reduce((acc, log) => acc + log.tcp, 0);
	const totalDtd = sortedLogs.reduce((acc, log) => acc + log.dtd, 0);
	const magicItems = sortedLogs.reduce((acc, log) => {
		acc.push(
			...log.magicItemsGained.filter((magicItem) => {
				return !magicItem.logLostId;
			})
		);
		return acc;
	}, [] as MagicItem[]);
	const storyAwards = sortedLogs.reduce((acc, log) => {
		acc.push(
			...log.storyAwardsGained.filter((storyAward) => {
				return !storyAward.logLostId;
			})
		);
		return acc;
	}, [] as StoryAward[]);

	let level = 1;

	return {
		totalLevel,
		totalGold,
		totalTcp,
		totalDtd,
		magicItems,
		storyAwards,
		lastLog: sortedLogs.at(-1)?.showDate || new Date(0),
		logLevels: levels.logLevels,
		tier: Math.floor((totalLevel + 1) / 6) + 1,
		logs: sortedLogs.map((log) => {
			const levelGained = levels.logLevels.find((gl) => gl.id === log.id);
			if (levelGained) level += levelGained.levels;
			return {
				...log,
				levelGained: levelGained?.levels || 0,
				totalLevel: level
			} satisfies LogSummaryData;
		})
	};
}

export function defaultCharacter(user: LocalsUser): FullCharacterData {
	return parseCharacter({
		id: v7() as CharacterId,
		name: "",
		race: "",
		class: "",
		campaign: "",
		imageUrl: "",
		imageBytes: 0,
		characterSheetUrl: "",
		userId: user.id,
		user: user,
		createdAt: new Date(),
		logs: []
	});
}

export function defaultDM(userId: UserId): DungeonMaster {
	return { id: v7() as DungeonMasterId, name: "", DCI: "", userId: userId, isUser: false };
}

export function defaultLogSchema(
	userId: UserId,
	options?: {
		character?: { id: CharacterId | null; name: string };
		defaults?: Partial<LogSchema>;
	}
): LogSchema {
	return {
		id: v7() as LogId,
		name: "",
		description: "",
		date: new Date(),
		timezone: "",
		type: "game",
		experience: 0,
		acp: 0,
		tcp: 0,
		level: 0,
		gold: 0,
		dtd: 0,
		characterId: options?.character?.id || ("" as CharacterId),
		characterName: options?.character?.name || "",
		appliedDate: null,
		dm: defaultDM(userId),
		isDmLog: !options?.character?.id,
		magicItemsGained: [],
		magicItemsLost: [],
		storyAwardsGained: [],
		storyAwardsLost: [],
		...options?.defaults
	};
}

export function parseCharacter(character: CharacterData): FullCharacterData {
	return {
		...character,
		imageUrl: character.imageUrl || BLANK_CHARACTER,
		...getLogsSummary(character.logs)
	};
}

export function parseLog(log: LogData | ExtendedLogData): FullLogData {
	return {
		...log,
		character: "character" in log && log.character && log.character.name !== PlaceholderName ? log.character : null,
		showDate: log.isDmLog && log.appliedDate ? log.appliedDate : log.date
	};
}

export function logDataToSchema(userId: UserId, log: FullLogData): LogSchema {
	return {
		...omit(log, ["createdAt", "character", "showDate"]),
		date: new Date(log.date),
		timezone: log.timezone || "",
		characterName: log.character?.name || "",
		appliedDate: log.appliedDate ? new Date(log.appliedDate) : null,
		dm: log.dm.id ? log.dm : defaultDM(userId),
		magicItemsGained: log.magicItemsGained.map((item) => ({
			id: item.id,
			name: item.name,
			description: item.description || ""
		})),
		magicItemsLost: log.magicItemsLost.map((item) => item.id),
		storyAwardsGained: log.storyAwardsGained.map((award) => ({
			id: award.id,
			name: award.name,
			description: award.description || ""
		})),
		storyAwardsLost: log.storyAwardsLost.map((award) => award.id)
	};
}
