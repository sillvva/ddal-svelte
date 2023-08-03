import { defaultLog } from "$lib/entities";
import { prisma } from "$src/server/db";
import { cache } from "../cache";

export type LogData = Exclude<Awaited<ReturnType<typeof getLog>>, null>;
export async function getLog(logId: string, characterId = "") {
	const log = await prisma.log.findFirst({
		where: { id: logId },
		include: {
			dm: true,
			magic_items_gained: true,
			magic_items_lost: true,
			story_awards_gained: true,
			story_awards_lost: true
		}
	});
	return log || defaultLog(characterId);
}

export type DMLogData = Exclude<Awaited<ReturnType<typeof getDMLog>>, null>;
export async function getDMLog(logId: string) {
	const log = await prisma.log.findFirst({
		where: { id: logId, is_dm_log: true },
		include: {
			dm: true,
			magic_items_gained: true,
			magic_items_lost: true,
			story_awards_gained: true,
			story_awards_lost: true
		}
	});
	return log || defaultLog();
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
	return await cache(() => getDMLogs(userId, userName), ["dm-logs", userId]);
}
