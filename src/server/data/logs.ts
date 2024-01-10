import { defaultDM, defaultLog } from "$lib/entities";
import { prisma } from "$src/server/db";
import type { DungeonMaster, Log, MagicItem, StoryAward } from "@prisma/client";
import { cache } from "../cache";

export type LogData = Log & {
	dm: DungeonMaster;
	magic_items_gained: Array<MagicItem>;
	magic_items_lost: Array<MagicItem>;
	story_awards_gained: Array<StoryAward>;
	story_awards_lost: Array<StoryAward>;
};
export async function getLog(logId: string, userId: string, characterId = ""): Promise<LogData> {
	const log = (await prisma.log.findFirst({
		where: { id: logId },
		include: {
			dm: true,
			magic_items_gained: true,
			magic_items_lost: true,
			story_awards_gained: true,
			story_awards_lost: true
		}
	})) || defaultLog(userId, characterId);
	return { ...log, dm: log.dm || defaultDM(userId) };
}

export async function getDMLog(logId: string, userId: string): Promise<LogData> {
	const log = (await prisma.log.findFirst({
		where: { id: logId, is_dm_log: true },
		include: {
			dm: true,
			magic_items_gained: true,
			magic_items_lost: true,
			story_awards_gained: true,
			story_awards_lost: true
		}
	})) || defaultLog(userId);
	return { ...log, dm: log.dm || defaultDM(userId) };
}

export type DMLogsData = Awaited<ReturnType<typeof getDMLogs>>;
export async function getDMLogs(userId = "", userName = "") {
	return prisma.log.findMany({
		where: {
			is_dm_log: true,
			dm: {
				OR: [
					{
						uid: userId
					},
					{
						name: userName
					}
				]
			}
		},
		include: {
			dm: true,
			magic_items_gained: true,
			magic_items_lost: true,
			story_awards_gained: true,
			story_awards_lost: true,
			character: {
				include: {
					user: true
				}
			}
		}
	});
}

export async function getDMLogsCache(userId = "", userName = "") {
	return await cache(() => getDMLogs(userId, userName), ["dm-logs", userId], 86400);
}
