import { defaultDM, defaultLogData, parseLog } from "$lib/entities";
import type { CharacterId, LogId, UserId } from "$lib/schemas";
import { cache } from "$server/cache";
import { q } from "$server/db";
import type { DungeonMaster, Log, MagicItem, StoryAward } from "$server/db/schema";

export const logIncludes = {
	dm: true,
	magicItemsGained: true,
	magicItemsLost: true,
	storyAwardsGained: true,
	storyAwardsLost: true
} as const;

export type LogData = Log & {
	dm: DungeonMaster | null;
	type: "game" | "nongame";
	magicItemsGained: MagicItem[];
	magicItemsLost: MagicItem[];
	storyAwardsGained: StoryAward[];
	storyAwardsLost: StoryAward[];
};
export async function getLog(logId: LogId, userId: UserId, characterId = "" as CharacterId): Promise<LogData> {
	const log =
		(await q.logs.findFirst({
			with: logIncludes,
			where: (logs, { eq }) => eq(logs.id, logId)
		})) || defaultLogData(userId, characterId);
	return { ...parseLog(log), dm: log.dm || defaultDM(userId) };
}

export async function getDMLog(logId: LogId, userId: UserId): Promise<LogData> {
	const log =
		(await q.logs.findFirst({
			with: logIncludes,
			where: (logs, { eq, and }) => and(eq(logs.id, logId), eq(logs.isDmLog, true))
		})) || defaultLogData(userId);
	return { ...parseLog(log), dm: log.dm || defaultDM(userId) };
}

export type DMLogsData = Awaited<ReturnType<typeof getDMLogs>>;
export async function getDMLogs(userId: UserId) {
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
				...logIncludes,
				character: {
					with: {
						user: true
					}
				}
			},
			where: (logs, { eq, and, inArray }) =>
				and(
					eq(logs.isDmLog, true),
					inArray(
						logs.dungeonMasterId,
						dms.map((dm) => dm.id)
					)
				),
			orderBy: (logs, { asc }) => asc(logs.date)
		})
		.then((logs) => {
			return logs.map(parseLog);
		});
}

export async function getDMLogsCache(userId: UserId) {
	return await cache(() => getDMLogs(userId), ["dm-logs", userId], 86400);
}

export async function getUserLogs(userId: UserId) {
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
			isDmLog: true
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
					imageUrl: true
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
