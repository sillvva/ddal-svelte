import { defaultDM, defaultLogData, parseLog } from "$lib/entities";
import type { CharacterId, LogId, UserId } from "$lib/schemas";
import { userIncludes } from "$server/actions/users";
import { q, type InferQueryModel, type QueryConfig } from "$server/db";

export const logIncludes = {
	dm: true,
	magicItemsGained: true,
	magicItemsLost: true,
	storyAwardsGained: true,
	storyAwardsLost: true
} as const satisfies QueryConfig<"logs">["with"];
export const logCharacterIncludes = {
	user: userIncludes
} as const satisfies QueryConfig<"characters">["with"];

export type LogData = InferQueryModel<"logs", { with: typeof logIncludes }>;
export type LogCharacterData = InferQueryModel<"characters", { with: typeof logCharacterIncludes }> | null;

export async function getLog(logId: LogId, userId: UserId, characterId = "" as CharacterId): Promise<LogData> {
	const log =
		(await q.logs.findFirst({
			with: logIncludes,
			where: {
				id: {
					eq: logId
				}
			}
		})) || defaultLogData(userId, characterId);
	return { ...parseLog(log), dm: log.dm || defaultDM(userId) };
}

export async function getDMLog(logId: LogId, userId: UserId): Promise<LogData> {
	const log =
		(await q.logs.findFirst({
			with: logIncludes,
			where: {
				id: {
					eq: logId
				},
				isDmLog: true
			}
		})) || defaultLogData(userId);
	return { ...parseLog(log), dm: log.dm || defaultDM(userId) };
}

export type DMLogsData = Awaited<ReturnType<typeof getDMLogs>>;
export async function getDMLogs(userId: UserId) {
	return q.logs
		.findMany({
			with: {
				...logIncludes,
				character: {
					with: logCharacterIncludes
				}
			},
			where: {
				isDmLog: true,
				dm: {
					uid: {
						eq: userId
					}
				}
			},
			orderBy: {
				date: "asc"
			}
		})
		.then((logs) => {
			return logs.map(parseLog);
		});
}

export async function getUserLogs(userId: UserId) {
	return q.logs.findMany({
		columns: {
			id: true,
			name: true,
			date: true,
			appliedDate: true,
			isDmLog: true,
			gold: true
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
			},
			magicItemsGained: {
				columns: {
					name: true
				}
			},
			storyAwardsGained: {
				columns: {
					name: true
				}
			}
		},
		where: {
			character: {
				userId: {
					eq: userId
				}
			}
		},
		orderBy: {
			date: "asc"
		}
	});
}
