import { parseLog } from "#lib/entities.js";
import type {
	CharacterId,
	DungeonMasterId,
	DungeonMasterSchema,
	ItemsGainedSchema,
	ItemsLostSchema,
	LocalsUser,
	LogId,
	LogSchema,
	UserId
} from "#lib/schemas.js";
import { extendedLogIncludes, logIncludes } from "#lib/server/db/includes.js";
import {
	buildConflictUpdateColumns,
	DBService,
	runQuery,
	type Database,
	type DrizzleError,
	type Filter,
	type InferQueryResult,
	type Transaction
} from "#lib/server/db/index.js";
import { characters, dungeonMasters, logs, magicItems, storyAwards } from "#lib/server/db/schema.js";
import { serializeError, type ErrorParams } from "#lib/server/effect/errors.js";
import { AppLog } from "#lib/server/effect/logging.js";
import { getRequestEvent } from "$app/server";
import { isTupleOf } from "@sillvva/utils";
import { and, eq, exists, inArray, isNull, notInArray, or } from "drizzle-orm";
import { Context, Data, Effect, Layer } from "effect";
import { v7 } from "uuid";
import { DMService, DMTx } from "./dms";

export class LogNotFoundError extends Data.TaggedError("LogNotFoundError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Log not found", status: 404, cause: err });
	}
}

export class SaveLogError extends Data.TaggedError("SaveLogError")<ErrorParams> {
	constructor(message: string, err?: unknown) {
		super({ message, status: 404, cause: err });
	}
}

export class DeleteLogError extends Data.TaggedError("DeleteLogError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Unable to delete log", status: 404, cause: err });
	}
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

/** SQL twin of `characterLogFilter` and `dmLogFilter`, for writes. */
const ownedLogSql = (db: Database | Transaction, userId: UserId) =>
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
	);

// Getters
const getCharacterLog = Effect.fn("LogService.get.one")(function* (logId: LogId, userId: UserId, db: Database | Transaction) {
	if (logId === "new") return undefined;

	return yield* runQuery(
		db.query.logs.findFirst({
			with: extendedLogIncludes,
			where: {
				id: {
					eq: logId
				},
				OR: [characterLogFilter(userId), dmLogFilter(userId)]
			}
		})
	).pipe(
		Effect.map((log) => log && parseLog(log)),
		Effect.tapError((error) => AppLog.debug("LogService.get.one", { logId, userId, error: serializeError(error) }))
	);
});

const getDMLogs = Effect.fn("LogService.get.dm")(function* (userId: UserId, db: Database | Transaction) {
	const dmLogs = yield* runQuery(
		db.query.logs.findMany({
			with: extendedLogIncludes,
			where: dmLogFilter(userId),
			orderBy: {
				date: "asc"
			}
		})
	).pipe(
		Effect.map((logs) => logs.map(parseLog)),
		Effect.tapError((error) => AppLog.debug("LogService.get.dm", { userId, error: serializeError(error) }))
	);

	const event = getRequestEvent();
	const timezone = event.locals.app.settings.timezone;
	if (timezone) yield* addMissingTimeZones(db, timezone, dmLogs);

	return dmLogs;
});

const getAllLogs = Effect.fn("LogService.get.all")(function* (userId: UserId, db: Database | Transaction) {
	return yield* runQuery(
		db.query.logs.findMany({
			...userLogsConfig,
			where: {
				OR: [characterLogFilter(userId), dmLogFilter(userId)]
			},
			orderBy: {
				date: "asc"
			}
		})
	).pipe(Effect.tapError((error) => AppLog.debug("LogService.get.all", { userId, error: serializeError(error) })));
});

const validateLogDM = Effect.fn("validateLogDM")(function* (log: LogSchema, user: LocalsUser) {
	const DMs = yield* DMService;

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

	if (isUser || (dmName && !dmId) || log.dm.DCI) {
		const search = yield* DMs.get.fuzzySearch(user.id, isUser, log.dm);
		if (search) {
			if (search.name === dmName && search.DCI === log.dm.DCI) return search;
			if (search.isUser) isUser = true;
			dmId = search.id;
		}
	}

	return {
		id: dmId || (v7() as DungeonMasterId),
		name: dmName,
		DCI: log.dm.DCI,
		userId: user.id,
		isUser
	} satisfies DungeonMasterSchema;
});

const upsertLogDM = Effect.fn("upsertLogDM")(function* (tx: Transaction, log: LogSchema, user: LocalsUser) {
	const validated = yield* validateLogDM(log, user);

	return yield* runQuery(
		tx
			.insert(dungeonMasters)
			.values(validated)
			.onConflictDoUpdate({
				target: dungeonMasters.id,
				set: buildConflictUpdateColumns(dungeonMasters, ["name", "DCI"]),
				setWhere: eq(dungeonMasters.userId, user.id)
			})
			.returning()
	).pipe(
		Effect.flatMap((dms) =>
			isTupleOf(dms, 1) ? Effect.succeed(dms[0]) : Effect.fail(new SaveLogError("Could not save Dungeon Master"))
		)
	);
});

const upsertLog = Effect.fn("upsertLog")(function* (tx: Transaction, log: LogSchema, user: LocalsUser) {
	const dm = yield* upsertLogDM(tx, log, user);

	const appliedDate: Date | null = log.isDmLog
		? log.characterId && log.appliedDate !== null
			? new Date(log.appliedDate)
			: null
		: new Date(log.date);

	const [result] = yield* runQuery(
		tx
			.insert(logs)
			.values({
				id: log.id,
				name: log.name,
				date: log.date,
				timezone: log.timezone,
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
				set: buildConflictUpdateColumns(logs, ["id", "createdAt", "isDmLog"], true),
				setWhere: ownedLogSql(tx, user.id)
			})
			.returning()
	);

	if (!result?.id) return yield* new SaveLogError(log.id ? "Could not save log" : "Could not create log");

	yield* Effect.all(
		[
			...itemsCRUD(tx, {
				logId: result.id,
				characterId: result.characterId,
				table: magicItems,
				gained: log.magicItemsGained,
				lost: log.magicItemsLost
			}),
			...itemsCRUD(tx, {
				logId: result.id,
				characterId: result.characterId,
				table: storyAwards,
				gained: log.storyAwardsGained,
				lost: log.storyAwardsLost
			})
		],
		{ concurrency: 4 }
	);

	return yield* getCharacterLog(result.id, user.id, tx).pipe(
		Effect.flatMap((result) =>
			result ? Effect.succeed(result) : Effect.fail(new SaveLogError(log.id ? "Could not save log" : "Could not create log"))
		)
	);
});

export const addMissingTimeZones = Effect.fn("addMissingTimeZones")(function* (
	tx: Database | Transaction,
	timezone: string,
	logRecords: Pick<FullLogData, "id" | "timezone">[]
) {
	const logsWithoutTimeZone = logRecords.filter((log) => log.timezone === null);
	if (logsWithoutTimeZone.length > 0) {
		const batchSize = 200;
		const effects = [];

		for (let i = 0; i < logsWithoutTimeZone.length; i += batchSize) {
			const batch = logsWithoutTimeZone.slice(i, i + batchSize);
			effects.push(
				runQuery(
					tx
						.update(logs)
						.set({ timezone })
						.where(
							inArray(
								logs.id,
								batch.map((log) => log.id)
							)
						)
				)
			);
		}

		yield* Effect.all(effects, { concurrency: 5 });

		logRecords.forEach((log) => {
			log.timezone ||= timezone;
		});
	}
});

interface CRUDItemParams {
	logId: LogId;
	/** An unassigned DM log has no character inventory, so it cannot drop items. */
	characterId: CharacterId | null;
	gained: ItemsGainedSchema;
	lost: ItemsLostSchema;
}

interface CRUDMagicItemParams extends CRUDItemParams {
	table: typeof magicItems;
}

interface CRUDStoryAwardParams extends CRUDItemParams {
	table: typeof storyAwards;
}

function itemsCRUD(tx: Transaction, params: CRUDMagicItemParams | CRUDStoryAwardParams) {
	const { logId, characterId, table, gained, lost } = params;

	const effects: Effect.Effect<void, DrizzleError | SaveLogError>[] = [];
	const itemIds = gained.map((item) => item.id).filter(Boolean);

	effects.push(
		runQuery(
			tx.delete(table).where(and(eq(table.logGainedId, logId), itemIds.length ? notInArray(table.id, itemIds) : undefined))
		)
	);

	if (gained.length) {
		effects.push(
			runQuery(
				tx
					.insert(table)
					.values(
						gained.map((item) => ({
							id: item.id,
							name: item.name,
							description: item.description,
							logGainedId: logId
						}))
					)
					.onConflictDoUpdate({
						target: table.id,
						set: buildConflictUpdateColumns(table, ["name", "description"]),
						setWhere: eq(table.logGainedId, logId)
					})
					.returning({ id: table.id })
			).pipe(
				Effect.flatMap((saved) =>
					saved.length === gained.length ? Effect.void : Effect.fail(new SaveLogError("Could not save items"))
				)
			)
		);
	}

	effects.push(
		runQuery(
			tx
				.update(table)
				.set({ logLostId: null })
				.where(and(eq(table.logLostId, logId), lost.length ? notInArray(table.id, lost) : undefined))
		)
	);

	if (lost.length && characterId) {
		effects.push(
			runQuery(
				tx
					.update(table)
					.set({ logLostId: logId })
					.where(
						and(
							isNull(table.logLostId),
							inArray(table.id, lost),
							inArray(table.logGainedId, tx.select({ id: logs.id }).from(logs).where(eq(logs.characterId, characterId)))
						)
					)
			)
		);
	}

	return effects;
}

const deleteLog = Effect.fn("LogService.delete")(function* (logId: LogId, userId: UserId, db: Database | Transaction) {
	return yield* runQuery(
		db
			.delete(logs)
			.where(and(eq(logs.id, logId), ownedLogSql(db, userId)))
			.returning({ id: logs.id, characterId: logs.characterId, dungeonMasterId: logs.dungeonMasterId })
	).pipe(
		Effect.flatMap((logs) => (isTupleOf(logs, 1) ? Effect.succeed(logs[0]) : Effect.fail(new DeleteLogError()))),
		Effect.tap((result) => AppLog.info("LogService.delete", { logId, userId, result })),
		Effect.tapError((error) => AppLog.debug("LogService.delete", { logId, userId, error: serializeError(error) }))
	);
});

export class LogService extends Context.Service<LogService>()("LogService", {
	make: Effect.fn("LogService")(function* () {
		const { db, transaction } = yield* DBService;

		return {
			/**
			 * Queries
			 */

			get: {
				one: Effect.fn("LogService.get.one")(function* (logId: LogId, userId: UserId) {
					return yield* getCharacterLog(logId, userId, db);
				}),
				dm: Effect.fn("LogService.get.dm")(function* (userId) {
					return yield* getDMLogs(userId, db);
				}),
				all: Effect.fn("LogService.get.all")(function* (userId) {
					return yield* getAllLogs(userId, db);
				})
			},

			/**
			 * Mutations
			 */

			save: Effect.fn("LogService.save")(function* (log: LogSchema, user: LocalsUser) {
				return yield* transaction(
					Effect.fn(function* (tx) {
						return yield* upsertLog(tx, log, user).pipe(Effect.provide(DMTx(tx)));
					})
				).pipe(
					Effect.tap((result) => AppLog.info("LogService.save", { logId: log.id, userId: user.id, result })),
					Effect.tapError((error) =>
						AppLog.debug("LogService.save", { logId: log.id, userId: user.id, log, error: serializeError(error) })
					)
				);
			}),
			delete: Effect.fn("LogService.delete")(function* (logId: LogId, userId: UserId) {
				return yield* deleteLog(logId, userId, db);
			})
		};
	})()
}) {
	static readonly layer = Layer.effect(this, this.make);
}
