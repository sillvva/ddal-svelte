import { defaultDM, defaultLogData, parseLog } from "$lib/entities";
import type { CharacterId, LogId, UserId } from "$lib/schemas";
import { cache } from "$server/cache";
import { db, q } from "$server/db";
import { characters, dungeonMasters, type DungeonMaster, type Log, type MagicItem, type StoryAward } from "$server/db/schema";
import { eq, sql } from "drizzle-orm";

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
	const dms = db.select({ id: dungeonMasters.id }).from(dungeonMasters).where(eq(dungeonMasters.uid, userId));

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
			where: (logs, { eq, and, inArray }) => and(eq(logs.isDmLog, true), inArray(logs.dungeonMasterId, sql`${dms}`)),
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
	const characterIds = db.select({ id: characters.id }).from(characters).where(eq(characters.userId, userId));

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
		where: (logs, { inArray }) => inArray(logs.characterId, sql`${characterIds}`),
		orderBy: (logs, { desc }) => desc(logs.date)
	});
}
