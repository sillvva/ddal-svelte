import { defaultDM, defaultLogData, parseLogEnums } from "$lib/entities";
import type { SelectDungeonMaster, SelectLog, SelectMagicItem, SelectStoryAward } from "$src/db/schema";
import { q } from "$src/server/db";
import { cache } from "../cache";

export type LogData = SelectLog & {
	dm: SelectDungeonMaster | null;
	type: "game" | "nongame";
	magic_items_gained: SelectMagicItem[];
	magic_items_lost: SelectMagicItem[];
	story_awards_gained: SelectStoryAward[];
	story_awards_lost: SelectStoryAward[];
};
export async function getLog(logId: string, userId: string, characterId = ""): Promise<LogData> {
	const log =
		(await q.logs.findFirst({
			with: {
				dm: true,
				magic_items_gained: true,
				magic_items_lost: true,
				story_awards_gained: true,
				story_awards_lost: true
			},
			where: (logs, { eq }) => eq(logs.id, logId)
		})) || defaultLogData(userId, characterId);
	return { ...parseLogEnums(log), dm: log.dm || defaultDM(userId) };
}

export async function getDMLog(logId: string, userId: string): Promise<LogData> {
	const log =
		(await q.logs.findFirst({
			with: {
				dm: true,
				magic_items_gained: true,
				magic_items_lost: true,
				story_awards_gained: true,
				story_awards_lost: true
			},
			where: (logs, { eq, and }) => and(eq(logs.id, logId), eq(logs.is_dm_log, true))
		})) || defaultLogData(userId);
	return { ...parseLogEnums(log), dm: log.dm || defaultDM(userId) };
}

export type DMLogsData = Awaited<ReturnType<typeof getDMLogs>>;
export async function getDMLogs(userId: string) {
	const dms = await q.dungeonMasters.findMany({
		columns: {
			id: true
		},
		where: (dms, { eq }) => eq(dms.uid, userId)
	});

	if (!dms.length) return [];

	return q.logs
		.findMany({
			with: {
				dm: true,
				magic_items_gained: true,
				magic_items_lost: true,
				story_awards_gained: true,
				story_awards_lost: true,
				character: {
					with: {
						user: true
					}
				}
			},
			where: (logs, { eq, and, inArray }) =>
				and(
					eq(logs.is_dm_log, true),
					inArray(
						logs.dungeonMasterId,
						dms.map((dm) => dm.id)
					)
				),
			orderBy: (logs, { asc }) => asc(logs.date)
		})
		.then((logs) => {
			return logs.map(parseLogEnums);
		});
}

export async function getDMLogsCache(userId: string) {
	return await cache(() => getDMLogs(userId), ["dm-logs", userId], 86400);
}

export async function getUserLogs(userId: string) {
	const characters = await q.characters.findMany({
		columns: {
			id: true
		},
		where: (characters, { eq }) => eq(characters.userId, userId)
	});

	return q.logs.findMany({
		columns: {
			id: true,
			name: true,
			date: true,
			is_dm_log: true
		},
		with: {
			dm: {
				columns: {
					name: true
				}
			},
			character: {
				columns: {
					id: true,
					name: true,
					image_url: true
				}
			}
		},
		where: (logs, { inArray }) =>
			inArray(
				logs.characterId,
				characters.map((character) => character.id)
			),
		orderBy: (logs, { desc }) => desc(logs.date)
	});
}
