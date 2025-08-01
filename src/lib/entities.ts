import type { DungeonMaster, Log, MagicItem, StoryAward } from "$server/db/schema";
import type { CharacterData, FullCharacterData } from "$server/effect/characters";
import type { ExtendedLogData, FullLogData, LogData, LogSummaryData } from "$server/effect/logs";
import { sorter } from "@sillvva/utils";
import { BLANK_CHARACTER, PlaceholderName } from "./constants";
import type { CharacterId, DungeonMasterId, LogIdOrNew, LogSchema, UserId } from "./schemas";

export function getItemEntities(
	character: FullCharacterData,
	options?: {
		lastLogId?: LogIdOrNew;
		lastLogDate?: string;
		excludeDropped?: boolean;
	}
) {
	const { lastLogId = "", lastLogDate = "", excludeDropped = false } = options || {};
	const magicItems: MagicItem[] = [];
	const storyAwards: StoryAward[] = [];
	let lastLog = false;
	character.logs
		.toSorted((a, b) => sorter(a.date, b.date))
		.forEach((log) => {
			if (lastLog) return;
			if (lastLogId && log.id === lastLogId) lastLog = true;
			if (lastLogDate && new Date(log.date) >= new Date(lastLogDate)) lastLog = true;
			if (!lastLog) {
				log.magicItemsGained.forEach((item) => {
					magicItems.push(item);
				});
				log.storyAwardsGained.forEach((item) => {
					storyAwards.push(item);
				});
				if (excludeDropped) {
					log.magicItemsLost.forEach((item) => {
						magicItems.splice(
							magicItems.findIndex((i) => i.id === item.id),
							1
						);
					});
					log.storyAwardsLost.forEach((item) => {
						storyAwards.splice(
							storyAwards.findIndex((i) => i.id === item.id),
							1
						);
					});
				}
			}
		});
	return { magicItems, storyAwards };
}

export function getLevels(
	logs: Log[],
	base: { level?: number; experience?: number; acp?: number } = { level: 0, experience: 0, acp: 0 }
) {
	if (!logs) logs = [];
	let totalLevel = Math.max(1, base.level || 0);
	const logLevels: Array<{ id: string; levels: number }> = [];

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

export function defaultDM(userId: UserId): DungeonMaster {
	return { id: "" as DungeonMasterId, name: "", DCI: null, userId: userId, isUser: true };
}

export function defaultLogSchema(
	userId: UserId,
	character: { id: CharacterId | null; name: string } = { id: null, name: "" }
): LogSchema {
	return {
		id: "new",
		name: "",
		description: "",
		date: new Date(),
		type: "game",
		experience: 0,
		acp: 0,
		tcp: 0,
		level: 0,
		gold: 0,
		dtd: 0,
		characterId: character.id,
		characterName: character.name,
		appliedDate: null,
		dm: defaultDM(userId),
		isDmLog: !character.id,
		magicItemsGained: [],
		magicItemsLost: [],
		storyAwardsGained: [],
		storyAwardsLost: []
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
		...log,
		date: new Date(log.date),
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
