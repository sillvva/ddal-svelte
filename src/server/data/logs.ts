import { parseLog } from "$lib/entities";
import type { LogId, UserId } from "$lib/schemas";
import { q, type Filter, type InferQueryResult } from "$server/db";
import { extendedLogIncludes, logIncludes } from "$server/db/includes";

export type LogData = InferQueryResult<"logs", { with: typeof logIncludes }>;
export type ExtendedLogData = InferQueryResult<"logs", { with: typeof extendedLogIncludes }>;
export interface FullLogData extends ExtendedLogData {
	show_date: Date;
}

const characterLogFilter = (userId: UserId) => {
	return {
		isDmLog: false,
		character: {
			userId: {
				eq: userId
			}
		}
	} satisfies Filter<"logs">;
};

const dmLogFilter = (userId: UserId) => {
	return {
		isDmLog: true,
		dm: {
			userId: {
				eq: userId
			},
			isUser: true
		}
	} satisfies Filter<"logs">;
};

export async function getLog(logId: LogId, userId: UserId): Promise<FullLogData | undefined> {
	if (logId === "new") return undefined;
	const log = await q.logs.findFirst({
		with: extendedLogIncludes,
		where: {
			id: {
				eq: logId
			},
			OR: [characterLogFilter(userId), dmLogFilter(userId)]
		}
	});
	return log && parseLog(log);
}

export async function getDMLogs(userId: UserId): Promise<FullLogData[]> {
	return q.logs
		.findMany({
			with: extendedLogIncludes,
			where: dmLogFilter(userId),
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
			OR: [characterLogFilter(userId), dmLogFilter(userId)]
		},
		orderBy: {
			date: "asc"
		}
	});
}
