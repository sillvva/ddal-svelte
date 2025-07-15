import { parseLog } from "$lib/entities";
import type { LocalsUser, LogId, LogSchema, UserId } from "$lib/schemas";
import { buildConflictUpdateColumns, type Database, type Filter, type InferQueryResult, type Transaction } from "$server/db";
import { extendedLogIncludes, logIncludes } from "$server/db/includes";
import { dungeonMasters, logs, magicItems, storyAwards } from "$server/db/schema";
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { isTupleOf } from "effect/Predicate";
import { DBService, debugSet, FetchError, FormError, Log, run } from ".";
import { DMService, DMTx } from "./dms";

export class FetchLogError extends FetchError {}
function createFetchError(err: unknown): FetchLogError {
	return FetchLogError.from(err);
}

class SaveLogError extends FormError<LogSchema> {}
function createSaveError(err: unknown): SaveLogError {
	return SaveLogError.from(err);
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

const userLogsConfig = {
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
	}
} as const;

export type UserLogData = InferQueryResult<"logs", typeof userLogsConfig>;

interface LogApiImpl {
	readonly db: Database | Transaction;
	readonly get: {
		readonly log: (logId: LogId, userId: UserId) => Effect.Effect<FullLogData | undefined, FetchLogError>;
		readonly dmLogs: (userId: UserId) => Effect.Effect<FullLogData[], FetchLogError>;
		readonly userLogs: (userId: UserId) => Effect.Effect<UserLogData[], FetchLogError>;
	};
	readonly set: {
		readonly save: (log: LogSchema, user: LocalsUser) => Effect.Effect<FullLogData, SaveLogError>;
		readonly delete: (logId: LogId, userId: UserId) => Effect.Effect<{ id: LogId }, SaveLogError>;
	};
}

function validateLogDM(log: LogSchema, user: LocalsUser) {
	return Effect.gen(function* () {
		const dmApi = yield* DMService;

		let isUser = log.isDmLog || log.dm.isUser || ["", user.name.toLowerCase()].includes(log.dm.name.toLowerCase().trim());
		let dmId = log.dm.id;
		let dmName = log.dm.name.trim();

		if (!log.dm.name.trim()) {
			if (isUser) {
				dmName = user.name.trim();
				isUser = true;
			} else {
				return yield* new SaveLogError("Dungeon Master name is required", {
					status: 400,
					field: "dm.name"
				});
			}
		}

		if (!dmId && (isUser || dmName || log.dm.DCI)) {
			const search = yield* dmApi.get.fuzzyDM(user.id, isUser, log.dm).pipe(Effect.catchAll(createSaveError));
			if (search) {
				if (search.name === dmName && search.DCI === log.dm.DCI) {
					return { id: search.id, name: search.name, DCI: search.DCI, userId: user.id, isUser: search.isUser };
				}
				if (search.isUser) isUser = true;
				dmId = search.id;
			}
		}

		return {
			id: dmId || undefined,
			name: dmName,
			DCI: log.dm.DCI,
			userId: user.id,
			isUser
		};
	});
}

function upsertLogDM(log: LogSchema, user: LocalsUser) {
	return Effect.gen(function* () {
		const { db } = yield* LogService;

		const validated = yield* validateLogDM(log, user);

		return yield* Effect.tryPromise({
			try: () =>
				db
					.insert(dungeonMasters)
					.values(validated)
					.onConflictDoUpdate({
						target: dungeonMasters.id,
						set: buildConflictUpdateColumns(dungeonMasters, ["name", "DCI"])
					})
					.returning(),
			catch: createSaveError
		}).pipe(
			Effect.flatMap((dms) =>
				isTupleOf(dms, 1) ? Effect.succeed(dms[0]) : Effect.fail(new SaveLogError("Could not save Dungeon Master"))
			)
		);
	});
}

function upsertLog(log: LogSchema, user: LocalsUser) {
	return Effect.gen(function* () {
		const logApi = yield* LogService;

		const dm = yield* upsertLogDM(log, user);

		const appliedDate: Date | null = log.isDmLog
			? log.characterId && log.appliedDate !== null
				? new Date(log.appliedDate)
				: null
			: new Date(log.date);

		const [result] = yield* Effect.tryPromise({
			try: () =>
				logApi.db
					.insert(logs)
					.values({
						id: log.id || undefined,
						name: log.name,
						date: log.date,
						description: log.description || "",
						type: log.type,
						isDmLog: log.isDmLog,
						dungeonMasterId: dm.id,
						acp: log.acp,
						tcp: log.tcp,
						experience: log.experience,
						level: log.level,
						gold: log.gold,
						dtd: log.dtd,
						characterId: log.characterId,
						appliedDate
					})
					.onConflictDoUpdate({
						target: logs.id,
						set: buildConflictUpdateColumns(logs, ["id", "createdAt", "isDmLog"], true)
					})
					.returning(),
			catch: createSaveError
		});

		if (!result?.id) return yield* new SaveLogError(log.id ? "Could not save log" : "Could not create log");

		yield* Effect.forEach(
			[
				{
					logId: result.id,
					table: magicItems,
					gained: log.magicItemsGained,
					lost: log.magicItemsLost
				},
				{
					logId: result.id,
					table: storyAwards,
					gained: log.storyAwardsGained,
					lost: log.storyAwardsLost
				}
			],
			(params) => itemsCRUD(params)
		);

		return yield* logApi.get.log(result.id, user.id).pipe(
			Effect.flatMap((result) =>
				result ? Effect.succeed(result) : Effect.fail(new SaveLogError(log.id ? "Could not save log" : "Could not create log"))
			),
			Effect.catchAll(createSaveError)
		);
	});
}

interface CRUDItemParams {
	logId: LogId;
}

interface CRUDMagicItemParams extends CRUDItemParams {
	table: typeof magicItems;
	gained: LogSchema["magicItemsGained"];
	lost: LogSchema["magicItemsLost"];
}

interface CRUDStoryAwardParams extends CRUDItemParams {
	table: typeof storyAwards;
	gained: LogSchema["storyAwardsGained"];
	lost: LogSchema["storyAwardsLost"];
}

function itemsCRUD(params: CRUDMagicItemParams | CRUDStoryAwardParams) {
	return Effect.gen(function* () {
		const { db } = yield* LogService;

		const { logId, table, gained, lost } = params;

		const itemIds = gained.map((item) => item.id).filter(Boolean);
		yield* Effect.tryPromise({
			try: () =>
				db.delete(table).where(and(eq(table.logGainedId, logId), itemIds.length ? notInArray(table.id, itemIds) : undefined)),
			catch: createSaveError
		});

		if (gained.length) {
			yield* Effect.tryPromise({
				try: () =>
					db
						.insert(table)
						.values(
							gained.map((item) => ({
								id: item.id || undefined,
								name: item.name,
								description: item.description,
								logGainedId: logId
							}))
						)
						.onConflictDoUpdate({
							target: table.id,
							set: buildConflictUpdateColumns(table, ["name", "description"])
						}),
				catch: createSaveError
			});
		}

		yield* Effect.tryPromise({
			try: () =>
				db
					.update(table)
					.set({ logLostId: null })
					.where(and(eq(table.logLostId, logId), notInArray(table.id, lost))),
			catch: createSaveError
		});
		if (lost.length) {
			yield* Effect.tryPromise({
				try: () =>
					db
						.update(table)
						.set({ logLostId: logId })
						.where(and(isNull(table.logLostId), inArray(table.id, lost))),
				catch: createSaveError
			});
		}
	});
}

export class LogService extends Effect.Service<LogService>()("LogService", {
	scoped: Effect.gen(function* () {
		const { db } = yield* DBService;

		const impl: LogApiImpl = {
			db,
			get: {
				log: (logId, userId) =>
					Effect.gen(function* () {
						yield* Log.info("LogApiLive.getLog", { logId, userId });

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
							catch: createFetchError
						}).pipe(Effect.andThen((log) => log && parseLog(log)));
					}),

				dmLogs: (userId) =>
					Effect.gen(function* () {
						yield* Log.info("LogApiLive.getDMLogs", { userId });

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
							catch: createFetchError
						});
					}),

				userLogs: (userId) =>
					Effect.gen(function* () {
						yield* Log.info("LogApiLive.getUserLogs", { userId });

						return yield* Effect.tryPromise({
							try: () =>
								db.query.logs.findMany({
									...userLogsConfig,
									where: {
										OR: [characterLogFilter(userId), dmLogFilter(userId)]
									},
									orderBy: {
										date: "asc"
									}
								}),
							catch: createFetchError
						});
					})
			},

			set: {
				save: (log, user) =>
					Effect.gen(function* () {
						yield* Log.info("LogApiLive.saveLog", { logId: log.id, userId: user.id });
						yield* Log.debug("LogApiLive.saveLog", log);

						return yield* Effect.tryPromise({
							try: () =>
								db.transaction((tx) => {
									return run(upsertLog(log, user).pipe(Effect.provide(LogTx(tx)), Effect.provide(DMTx(tx))));
								}),
							catch: createSaveError
						});
					}),

				delete: (logId, userId) =>
					Effect.gen(function* () {
						yield* Log.info("LogApiLive.deleteLog", { logId, userId });

						const log = yield* impl.get.log(logId, userId).pipe(Effect.catchAll(createSaveError));

						if (!log) return yield* new SaveLogError("Log not found", { status: 404 });
						if (!log.isDmLog && log.character && log.character.userId !== userId)
							return yield* new SaveLogError("Not authorized", { status: 401 });
						if (log.isDmLog && log.dm.userId !== userId) return yield* new SaveLogError("Not authorized", { status: 401 });

						return yield* Effect.tryPromise({
							try: () => db.delete(logs).where(eq(logs.id, logId)).returning({ id: logs.id }),
							catch: createSaveError
						}).pipe(
							Effect.flatMap((logs) =>
								isTupleOf(logs, 1) ? Effect.succeed(logs[0]) : Effect.fail(new SaveLogError("Log not found", { status: 404 }))
							)
						);
					})
			}
		};

		return impl;
	}),
	dependencies: [DBService.Default()]
}) {}

export const LogTx = (tx: Transaction) => LogService.DefaultWithoutDependencies.pipe(Layer.provide(DBService.Default(tx)));

export function withLog<R, E extends FetchLogError | SaveLogError>(impl: (service: LogApiImpl) => Effect.Effect<R, E>) {
	return Effect.gen(function* () {
		const logApi = yield* LogService;
		const result = yield* impl(logApi);

		yield* debugSet("LogService", impl, result);

		return result;
	}).pipe(Effect.provide(LogService.Default));
}
