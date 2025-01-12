import type { CharacterData } from "$server/data/characters";
import type { LogData } from "$server/data/logs";
import type { Character, DungeonMaster, Log, MagicItem, StoryAward, User } from "$server/db/schema";
import { sorter } from "@sillvva/utils";
import { PlaceholderName } from "./constants";
import type { CharacterId, DungeonMasterId, LogId, LogSchema, UserId } from "./schemas";
import type { Prettify } from "./util";

export function getItemEntities(
	character: CharacterData,
	options?: {
		lastLogId?: LogId;
		lastLogDate?: string;
		excludeDropped?: boolean;
	}
) {
	const { lastLogId = "", lastLogDate = "", excludeDropped = false } = options || {};
	const magicItems: MagicItem[] = [];
	const storyAwards: StoryAward[] = [];
	let lastLog = false;
	character.logs
		.sort((a, b) => sorter(a.date, b.date))
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
	const log_levels: Array<{ id: string; levels: number }> = [];

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
			log_levels.push({ id: log.id, levels: gainedLevels });
			totalLevel += gainedLevels;
		}
	});

	return {
		total: Math.min(20, totalLevel),
		log_levels
	};
}

export function getLogsSummary(
	logs: Array<
		Log & {
			dm: DungeonMaster | null;
			magicItemsGained: MagicItem[];
			magicItemsLost: MagicItem[];
			storyAwardsGained: StoryAward[];
			storyAwardsLost: StoryAward[];
		}
	>,
	includeLogs = true
) {
	logs = logs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

	const levels = getLevels(logs);

	const total_level = levels.total;
	const total_gold = logs.reduce((acc, log) => acc + log.gold, 0);
	const total_tcp = logs.reduce((acc, log) => acc + log.tcp, 0);
	const total_dtd = logs.reduce((acc, log) => acc + log.dtd, 0);
	const magic_items = logs.reduce((acc, log) => {
		acc.push(
			...log.magicItemsGained.filter((magicItem) => {
				return !magicItem.logLostId;
			})
		);
		return acc;
	}, [] as MagicItem[]);
	const story_awards = logs.reduce((acc, log) => {
		acc.push(
			...log.storyAwardsGained.filter((storyAward) => {
				return !storyAward.logLostId;
			})
		);
		return acc;
	}, [] as StoryAward[]);

	return {
		total_level,
		total_gold,
		total_tcp,
		total_dtd,
		magic_items,
		story_awards,
		log_levels: levels.log_levels,
		tier: Math.floor((total_level + 1) / 6) + 1,
		logs: includeLogs ? logs.map(parseLog) : []
	};
}

export function defaultDM(userId: UserId): DungeonMaster {
	return { id: "" as DungeonMasterId, name: "", DCI: null, uid: "" as UserId, owner: userId };
}

export function defaultLogData(userId: UserId, characterId = null as CharacterId | null): LogData {
	return {
		id: "" as LogId,
		name: "",
		description: "",
		date: new Date(),
		type: "game",
		createdAt: new Date(),
		experience: 0,
		acp: 0,
		tcp: 0,
		level: 0,
		gold: 0,
		dtd: 0,
		dungeonMasterId: "" as DungeonMasterId,
		dm: defaultDM(userId),
		characterId,
		appliedDate: null,
		isDmLog: !characterId,
		magicItemsGained: [],
		magicItemsLost: [],
		storyAwardsGained: [],
		storyAwardsLost: []
	};
}

export function parseLog(
	log: Omit<LogData & { character?: Prettify<Character & { user?: Pick<User, "id" | "name"> }> | null }, "type"> & {
		type: string;
	}
) {
	return {
		...log,
		type: log.type === "nongame" ? ("nongame" as const) : ("game" as const),
		character: log.character && log.character.name !== PlaceholderName ? log.character : undefined
	};
}

export function logDataToSchema(userId: UserId, log: LogData, character?: Character): LogSchema {
	return {
		...log,
		characterId: character?.id || null,
		characterName: character?.name || "",
		dm: log.dm?.id ? log.dm : defaultDM(userId),
		type: log.type as "game" | "nongame",
		date: new Date(log.date),
		appliedDate: log.appliedDate ? new Date(log.appliedDate) : null,
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

export function strippedCharacterData(character: CharacterData, logId?: LogId) {
	return {
		...character,
		logs: character.logs.filter((log) => log.id !== logId),
		log_levels: [],
		magicItems: [],
		storyAwards: []
	};
}
