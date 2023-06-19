import { prisma } from "$server/db";

import type { LogType } from "@prisma/client";

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
	return (
		log || {
			characterId: characterId,
			id: "",
			name: "",
			description: "",
			date: new Date(),
			type: "game" as LogType,
			created_at: new Date(),
			experience: 0,
			acp: 0,
			tcp: 0,
			level: 0,
			gold: 0,
			dtd: 0,
			dungeonMasterId: "",
			dm: {
				id: "",
				name: "",
				DCI: null,
				uid: ""
			},
			applied_date: new Date(),
			is_dm_log: false,
			magic_items_gained: [],
			magic_items_lost: [],
			story_awards_gained: [],
			story_awards_lost: []
		}
	);
}

export type DMLogData = Exclude<Awaited<ReturnType<typeof getDMLog>>, null>;
export async function getDMLog(logId: string) {
	return await prisma.log.findFirst({
		where: { id: logId, is_dm_log: true },
		include: {
			dm: true,
			magic_items_gained: true,
			magic_items_lost: true,
			story_awards_gained: true,
			story_awards_lost: true
		}
	});
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
