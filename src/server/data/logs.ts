import { parseLog } from "$lib/entities";
import type { LogId, UserId } from "$lib/schemas";
import type { Filter, InferQueryResult } from "$server/db";
import { DBService, FetchError } from "$server/db/effect";
import { extendedLogIncludes, logIncludes } from "$server/db/includes";
import { Effect } from "effect";

class FetchLogError extends FetchError {}
function createLogError(err: unknown): FetchLogError {
	return FetchLogError.from(err);
}

export type LogData = InferQueryResult<"logs", { with: typeof logIncludes }>;
export type ExtendedLogData = InferQueryResult<"logs", { with: typeof extendedLogIncludes }>;
export interface FullLogData extends ExtendedLogData {
	showDate: Date;
}
export interface LogSummaryData extends FullLogData {
	levelGained: number;
	totalLevel: number;
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

export function getLog(logId: LogId, userId: UserId) {
	return Effect.gen(function* () {
		if (logId === "new") return undefined;

		const Database = yield* DBService;
		const db = yield* Database.db;

		return yield* Effect.tryPromise({
			try: () =>
				db.query.logs.findFirst({
					with: extendedLogIncludes,
					where: {
						id: {
							eq: logId
						},
						OR: [characterLogFilter(userId), dmLogFilter(userId)]
					}
				}),
			catch: createLogError
		}).pipe(Effect.andThen((log) => log && parseLog(log)));
	});
}

export function getDMLogs(userId: UserId) {
	return Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

		return yield* Effect.tryPromise({
			try: () =>
				db.query.logs
					.findMany({
						with: extendedLogIncludes,
						where: dmLogFilter(userId),
						orderBy: {
							date: "asc"
						}
					})
					.then((logs) => {
						return logs.map(parseLog);
					}),
			catch: createLogError
		});
	});
}

export type UserLogData = Effect.Effect.Success<ReturnType<typeof getUserLogs>>;
export function getUserLogs(userId: UserId) {
	return Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

		return yield* Effect.tryPromise({
			try: () =>
				db.query.logs.findMany({
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
				}),
			catch: createLogError
		});
	});
}
