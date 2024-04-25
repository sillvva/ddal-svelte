import type { CharacterData, getCharacter } from "$server/data/characters";
import type { LogData } from "$server/data/logs";
import type { Character, DungeonMaster, Log, MagicItem, StoryAward, User } from "$server/db/schema";
import { sorter } from "@sillvva/utils";
import type { CharacterId, DungeonMasterId, LogId, LogSchema, UserId } from "./schemas";

export const getMagicItems = (
	character: Exclude<Awaited<ReturnType<typeof getCharacter>>, null>,
	options?: {
		lastLogId?: LogId;
		lastLogDate?: string;
		excludeDropped?: boolean;
	}
) => {
	const { lastLogId = "", lastLogDate = "", excludeDropped = false } = options || {};
	const magicItems: MagicItem[] = [];
	let lastLog = false;
	character.logs
		.sort((a, b) => sorter(a.date, b.date))
		.forEach((log) => {
			if (lastLog) return;
			if (lastLogId && log.id === lastLogId) lastLog = true;
			if (lastLogDate && new Date(log.date) >= new Date(lastLogDate)) lastLog = true;
			if (!lastLog)
				log.magicItemsGained.forEach((item) => {
					magicItems.push(item);
				});
			log.magicItemsLost.forEach((item) => {
				if (excludeDropped && !lastLog)
					magicItems.splice(
						magicItems.findIndex((i) => i.id === item.id),
						1
					);
			});
		});
	return magicItems;
};

export const getStoryAwards = (
	character: Exclude<Awaited<ReturnType<typeof getCharacter>>, null>,
	options?: {
		lastLogId?: LogId;
		lastLogDate?: string;
		excludeDropped?: boolean;
	}
) => {
	const { lastLogId = "", lastLogDate = "", excludeDropped = false } = options || {};
	const storyAwards: StoryAward[] = [];
	let lastLog = false;
	character.logs
		.sort((a, b) => sorter(a.date, b.date))
		.forEach((log) => {
			if (lastLog) return;
			if (lastLogId && log.id === lastLogId) lastLog = true;
			if (lastLogDate && new Date(log.date) >= new Date(lastLogDate)) lastLog = true;
			if (!lastLog)
				log.storyAwardsGained.forEach((item) => {
					storyAwards.push(item);
				});
			log.storyAwardsLost.forEach((item) => {
				if (excludeDropped && !lastLog)
					storyAwards.splice(
						storyAwards.findIndex((i) => i.id === item.id),
						1
					);
			});
		});
	return storyAwards;
};

export function getLevels(
	logs: Log[],
	base: { level?: number; experience?: number; acp?: number } = { level: 0, experience: 0, acp: 0 }
) {
	if (!logs) logs = [];
	let totalLevel = 1;
	const log_levels: Array<{ id: string; levels: number }> = [];

	const xpLevels = [
		0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000,
		305000, 355000
	];
	let totalXp = base.level || 0;
	let next = 1;
	let xpDiff = 0;
	logs.forEach((log) => {
		totalXp += log.experience;
		let current = xpLevels[next];
		let gained = 0;
		while (current && totalXp >= current) {
			gained++;
			next++;
			if (next < 20) {
				xpDiff = (totalXp - current) / ((xpLevels[next] as number) - current);
			}
			current = xpLevels[next];
		}
		if (gained > 0) log_levels.push({ id: log.id, levels: gained });
		totalLevel += gained;
	});

	if (totalLevel < 20) {
		const acpLevels = [0];
		for (let i = 1; i < 20; i++) acpLevels.push((acpLevels[i - 1] as number) + (i <= 3 ? 4 : 8));
		let totalAcp = Math.round((acpLevels[totalLevel - 1] as number) + xpDiff * (totalLevel <= 3 ? 4 : 8));
		totalAcp += base.acp || 0;
		let acpDiff = 0;
		next = totalLevel;
		logs.forEach((log) => {
			totalAcp += log.acp;
			let current = acpLevels[next];
			let gained = 0;
			while (current && totalAcp >= current) {
				gained++;
				next++;
				if (next < 20) {
					acpDiff = (totalXp - current) / ((xpLevels[next] as number) - current);
				}
				current = acpLevels[next];
			}
			if (gained > 0) {
				const leveled = log_levels.findIndex((level) => level.id === log.id);
				if (leveled > -1) (log_levels[leveled] as (typeof log_levels)[number]).levels += gained;
				else log_levels.push({ id: log.id, levels: gained });
				totalLevel += gained;
			}
		});

		if (totalLevel < 20 && acpDiff > 0) totalLevel++;
	}

	logs.forEach((log) => {
		if (log.level > 0) {
			const leveled = log_levels.findIndex((level) => level.id === log.id);
			if (leveled > -1) (log_levels[leveled] as (typeof log_levels)[number]).levels += log.level;
			else log_levels.push({ id: log.id, levels: log.level });
		}
	});

	totalLevel += logs.reduce((acc, log) => acc + log.level, 0);
	totalLevel += base.level || 0;

	return {
		total: Math.min(20, totalLevel),
		log_levels
	};
}

export const getLogsSummary = (
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
) => {
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
};

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
	log: Omit<LogData & { character?: (Character & { user?: Pick<User, "id" | "name"> }) | null }, "type"> & { type: string }
) {
	return {
		...log,
		type: log.type === "nongame" ? ("nongame" as const) : ("game" as const),
		character: log.character?.name === "Placeholder" ? null : log.character
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
