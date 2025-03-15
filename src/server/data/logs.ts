import { defaultDM, parseLog } from "$lib/entities";
import type { LogId, UserId } from "$lib/schemas";
import type { Prettify } from "$lib/util";
import { userIncludes } from "$server/actions/users";
import { q, type InferQueryModel, type QueryConfig } from "$server/db";

export const logIncludes = {
	dm: true,
	magicItemsGained: true,
	magicItemsLost: true,
	storyAwardsGained: true,
	storyAwardsLost: true,
	character: {
		with: {
			user: userIncludes
		}
	}
} as const satisfies QueryConfig<"logs">["with"];

export type LogData = InferQueryModel<"logs", { with: typeof logIncludes }>;
export type FullLogData = Prettify<LogData & { show_date: Date }>;

export async function getLog(logId: LogId, userId: UserId): Promise<FullLogData | undefined> {
	if (logId === "new") return undefined;
	const log = await q.logs.findFirst({
		with: logIncludes,
		where: {
			id: {
				eq: logId
			},
			OR: [
				{
					isDmLog: false,
					character: {
						userId: {
							eq: userId
						}
					}
				},
				{
					isDmLog: true,
					dm: {
						uid: {
							eq: userId
						}
					}
				}
			]
		}
	});
	return log && { ...parseLog(log), dm: log.dm || defaultDM(userId) };
}

export async function getDMLogs(userId: UserId): Promise<FullLogData[]> {
	return q.logs
		.findMany({
			with: logIncludes,
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
			OR: [
				{
					character: {
						userId: {
							eq: userId
						}
					}
				},
				{
					dm: {
						uid: {
							eq: userId
						}
					}
				}
			]
		},
		orderBy: {
			date: "asc"
		}
	});
}
