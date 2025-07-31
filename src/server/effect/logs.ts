import { parseLog } from "$lib/entities";
import type { LocalsUser, LogId, LogIdOrNew, LogSchema, UserId } from "$lib/schemas";
import {
	buildConflictUpdateColumns,
	DBService,
	query,
	type Database,
	type DrizzleError,
	type Filter,
	type InferQueryResult,
	type Transaction
} from "$server/db";
import { extendedLogIncludes, logIncludes } from "$server/db/includes";
import { characters, dungeonMasters, logs, magicItems, storyAwards } from "$server/db/schema";
import { and, eq, exists, inArray, isNull, notInArray, or } from "drizzle-orm";
import { Data, Effect, Layer } from "effect";
import { isTupleOf } from "effect/Predicate";
import { debugSet, FormError, Log, type ErrorParams } from ".";
import { DMService, DMTx } from "./dms";

export class LogNotFoundError extends Data.TaggedError("LogNotFoundError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Log not found", status: 404, cause: err });
	}
}

export class SaveLogError extends FormError<LogSchema> {}
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
		readonly log: (logId: LogIdOrNew, userId: UserId) => Effect.Effect<FullLogData | undefined, DrizzleError>;
		readonly dmLogs: (userId: UserId) => Effect.Effect<FullLogData[], DrizzleError>;
		readonly userLogs: (userId: UserId) => Effect.Effect<UserLogData[], DrizzleError>;
	};
	readonly set: {
		readonly save: (log: LogSchema, user: LocalsUser) => Effect.Effect<FullLogData, SaveLogError | DrizzleError>;
		readonly delete: (logId: LogId, userId: UserId) => Effect.Effect<{ id: LogId }, SaveLogError | DrizzleError>;
	};
}

const validateLogDM = Effect.fn("validateLogDM")(function* (log, user) {
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
		const search = yield* dmApi.get.fuzzyDM(user.id, isUser, log.dm);
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

const upsertLogDM = Effect.fn("upsertLogDM")(function* (log: LogSchema, user: LocalsUser) {
	const { db } = yield* DMService;

	const validated = yield* validateLogDM(log, user);

	return yield* query(
		db
			.insert(dungeonMasters)
			.values(validated)
			.onConflictDoUpdate({
				target: dungeonMasters.id,
				set: buildConflictUpdateColumns(dungeonMasters, ["name", "DCI"])
			})
			.returning()
	).pipe(
		Effect.flatMap((dms) =>
			isTupleOf(dms, 1) ? Effect.succeed(dms[0]) : Effect.fail(new SaveLogError("Could not save Dungeon Master"))
		)
	);
});

const upsertLog = Effect.fn("upsertLog")(function* (log: LogSchema, user: LocalsUser) {
	const { db, get } = yield* LogService;

	const dm = yield* upsertLogDM(log, user);

	const appliedDate: Date | null = log.isDmLog
		? log.characterId && log.appliedDate !== null
			? new Date(log.appliedDate)
			: null
		: new Date(log.date);

	const [result] = yield* query(
		db
			.insert(logs)
			.values({
				id: log.id === "new" ? undefined : log.id,
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
			.returning()
	);

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

	return yield* get
		.log(result.id, user.id)
		.pipe(
			Effect.flatMap((result) =>
				result ? Effect.succeed(result) : Effect.fail(new SaveLogError(log.id ? "Could not save log" : "Could not create log"))
			)
		);
});

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

const itemsCRUD = Effect.fn("itemsCRUD")(function* (params: CRUDMagicItemParams | CRUDStoryAwardParams) {
	const { db } = yield* LogService;

	const { logId, table, gained, lost } = params;

	const itemIds = gained.map((item) => item.id).filter(Boolean);

	yield* query(
		db.delete(table).where(and(eq(table.logGainedId, logId), itemIds.length ? notInArray(table.id, itemIds) : undefined))
	);

	if (gained.length) {
		yield* query(
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
				})
		);
	}

	yield* query(
		db
			.update(table)
			.set({ logLostId: null })
			.where(and(eq(table.logLostId, logId), notInArray(table.id, lost)))
	);

	if (lost.length) {
		yield* query(
			db
				.update(table)
				.set({ logLostId: logId })
				.where(and(isNull(table.logLostId), inArray(table.id, lost)))
		);
	}
});

export class LogService extends Effect.Service<LogService>()("LogService", {
	effect: Effect.fn("LogService")(function* () {
		const { db, transaction } = yield* DBService;

		const impl: LogApiImpl = {
			db,
			get: {
				log: Effect.fn("LogService.get.log")(function* (logId, userId) {
					yield* Log.info("LogService.get.log", { logId, userId });
					if (logId === "new") return undefined;

					return yield* query(
						db.query.logs.findFirst({
							with: extendedLogIncludes,
							where: {
								id: {
									eq: logId
								},
								OR: [characterLogFilter(userId), dmLogFilter(userId)]
							}
						})
					).pipe(Effect.andThen((log) => log && parseLog(log)));
				}),

				dmLogs: Effect.fn("LogService.get.dmLogs")(function* (userId) {
					yield* Log.info("LogService.get.dmLogs", { userId });

					return yield* query(
						db.query.logs.findMany({
							with: extendedLogIncludes,
							where: dmLogFilter(userId),
							orderBy: {
								date: "asc"
							}
						})
					).pipe(Effect.map((logs) => logs.map(parseLog)));
				}),

				userLogs: Effect.fn("LogService.get.userLogs")(function* (userId) {
					yield* Log.info("LogService.get.userLogs", { userId });

					return yield* query(
						db.query.logs.findMany({
							...userLogsConfig,
							where: {
								OR: [characterLogFilter(userId), dmLogFilter(userId)]
							},
							orderBy: {
								date: "asc"
							}
						})
					);
				})
			},
			set: {
				save: Effect.fn("LogService.set.save")(function* (log, user) {
					yield* Log.info("LogService.set.save", { logId: log.id, userId: user.id });
					yield* Log.debug("LogService.set.save", log);

					return yield* transaction(
						(tx) => upsertLog(log, user).pipe(Effect.provide(LogTx(tx)), Effect.provide(DMTx(tx))),
						createSaveError
					);
				}),

				delete: Effect.fn("LogService.set.delete")(function* (logId, userId) {
					yield* Log.info("LogService.set.delete", { logId, userId });

					return yield* query(
						db
							.delete(logs)
							.where(
								and(
									eq(logs.id, logId),
									or(
										and(
											eq(logs.isDmLog, false),
											exists(
												db
													.select()
													.from(characters)
													.where(and(eq(characters.id, logs.characterId), eq(characters.userId, userId)))
											)
										),
										and(
											eq(logs.isDmLog, true),
											exists(
												db
													.select()
													.from(dungeonMasters)
													.where(
														and(
															eq(dungeonMasters.id, logs.dungeonMasterId),
															eq(dungeonMasters.userId, userId),
															eq(dungeonMasters.isUser, true)
														)
													)
											)
										)
									)
								)
							)
							.returning({ id: logs.id })
					).pipe(
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

export const LogTx = (tx: Transaction) => LogService.DefaultWithoutDependencies().pipe(Layer.provide(DBService.Default(tx)));

export const withLog = Effect.fn("withLog")(
	function* <R, E extends SaveLogError | DrizzleError>(impl: (service: LogApiImpl) => Effect.Effect<R, E>) {
		const logApi = yield* LogService;
		const result = yield* impl(logApi);

		yield* debugSet("LogService", impl, result);

		return result;
	},
	(effect) => effect.pipe(Effect.provide(LogService.Default()))
);
