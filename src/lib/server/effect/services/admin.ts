import type { AppLogId, AppLogSchema, UserId } from "$lib/schemas";
import { DBService, runQuery, type DrizzleError, type Filter, type Transaction, type TRSchema } from "$lib/server/db";
import type { relations } from "$lib/server/db/relations";
import { appLogs, type AppLog, type User } from "$lib/server/db/schema";
import { type ErrorParams } from "$lib/server/effect/errors";
import type { ParseMetadata } from "@sillvva/search";
import { DrizzleSearchParser } from "@sillvva/search/drizzle";
import { eq, sql } from "drizzle-orm";
import { Data, DateTime, Effect, Layer } from "effect";
import { isTupleOf } from "effect/Predicate";

export class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "User not found", status: 404, cause: err });
	}
}

export class SaveAppLogError extends Data.TaggedError("SaveAppLogError")<ErrorParams> {
	constructor(message: string, err?: unknown) {
		super({ message, status: 404, cause: err });
	}
}

export class DeleteLogError extends Data.TaggedError("DeleteLogError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Unable to delete log", status: 404, cause: err });
	}
}

interface AdminApiImpl {
	readonly get: {
		readonly user: (userId: UserId) => Effect.Effect<User, UserNotFoundError | DrizzleError>;
		readonly logs: (search?: string) => Effect.Effect<{ logs: AppLog[]; metadata?: ParseMetadata }, DrizzleError>;
	};
	readonly set: {
		readonly saveLog: (
			values: Omit<AppLogSchema, "id">
		) => Effect.Effect<Omit<AppLogSchema, "id">, SaveAppLogError | DrizzleError>;
		readonly deleteLog: (logId: AppLogId) => Effect.Effect<{ id: AppLogId }, DeleteLogError | DrizzleError>;
	};
}

export class AdminService extends Effect.Service<AdminService>()("AdminService", {
	effect: Effect.fn("AdminService")(function* () {
		const { db } = yield* DBService;

		const impl: AdminApiImpl = {
			get: {
				user: Effect.fn("AdminService.get.user")(function* (userId) {
					return yield* runQuery(
						db.query.user.findFirst({
							where: {
								id: {
									eq: userId
								}
							}
						})
					).pipe(Effect.flatMap((user) => (user ? Effect.succeed(user) : Effect.fail(new UserNotFoundError()))));
				}),
				logs: Effect.fn("AdminService.get.logs")(function* (search = "") {
					const { where, orderBy, metadata } = search.trim() ? logSearch.parse(search.trim()) : {};

					return yield* runQuery(
						db.query.appLogs.findMany({
							where,
							orderBy: {
								...orderBy,
								timestamp: "desc"
							}
						})
					).pipe(Effect.map((logs) => ({ logs, metadata })));
				})
			},
			set: {
				saveLog: Effect.fn("AdminService.set.saveLog")(function* (values) {
					if (values.label.startsWith("RedirectError")) return values;

					// Check if there's an existing record with the same label, routeId, and username in the last 5 seconds
					const today = yield* DateTime.now;
					const thirtySecondsAgo = today.pipe(DateTime.subtract({ seconds: 5 }));
					const routeId = values.annotations.routeId;
					const username = values.annotations.username;

					if (!username) return values;

					const whereConditions: Filter<"appLogs"> = {
						label: { eq: values.label },
						timestamp: { gte: DateTime.toDate(thirtySecondsAgo) },
						RAW: (table, { and: andOp }) => {
							const conditions: ReturnType<typeof sql>[] = [];

							if (routeId !== null) {
								conditions.push(sql`${table.annotations}->>'routeId' = ${routeId}`);
							} else {
								conditions.push(sql`${table.annotations}->>'routeId' IS NULL`);
							}

							if (username !== undefined) {
								conditions.push(sql`${table.annotations}->>'username' = ${username}`);
							} else {
								conditions.push(sql`${table.annotations}->>'username' IS NULL`);
							}

							const result = andOp(...conditions);
							return result ?? sql`1=1`;
						}
					};

					const existingLog = yield* runQuery(
						db.query.appLogs.findFirst({
							where: whereConditions
						})
					);

					// If a matching record exists, return it instead of inserting
					if (existingLog) return existingLog;

					return yield* runQuery(db.insert(appLogs).values([values]).returning()).pipe(
						Effect.flatMap((logs) =>
							isTupleOf(logs, 1) ? Effect.succeed(logs[0]) : Effect.fail(new SaveAppLogError("Unable to save app log"))
						)
					);
				}),
				deleteLog: Effect.fn("AdminService.set.deleteLog")(function* (logId) {
					return yield* runQuery(db.delete(appLogs).where(eq(appLogs.id, logId)).returning({ id: appLogs.id })).pipe(
						Effect.flatMap((logs) => (isTupleOf(logs, 1) ? Effect.succeed(logs[0]) : Effect.fail(new DeleteLogError())))
					);
				})
			}
		};

		return impl;
	}),
	dependencies: [DBService.Default()]
}) {}

export const AdminTx = (tx: Transaction) => AdminService.DefaultWithoutDependencies().pipe(Layer.provide(DBService.Default(tx)));

// -------------------------------------------------------------------------------------------------
// Search
// -------------------------------------------------------------------------------------------------

type Table = "appLogs";
type Column = keyof TRSchema[Table]["columns"];
type Key = Column | (string & {});
type ValidKey = (typeof validKeys)[number] | (string & {});

export const validKeys = ["id", "date", "label", "level", "username", "userId", "routeId"] as const satisfies Key[];
const defaultKey = "label" as const satisfies Column;

const logSearch = new DrizzleSearchParser<typeof relations, Table>({
	validKeys,
	defaultKey,
	filterFn: (ast) => {
		const key = (ast.key || defaultKey) as ValidKey;

		if (key === "username" || key === "userId" || key === "routeId") {
			if (ast.isRegex) return { RAW: (table) => sql`${table.annotations}->>${key}::text ~* ${ast.value}` };
			return { RAW: (table) => sql`${table.annotations}->>${key}::text ilike ${`%${ast.value}%`}` };
		}

		const keyColumns = new Map<typeof key, { col: Column; regex?: true; numeric?: true; date?: true }>([
			["id", { col: "id" }],
			["label", { col: "label", regex: true }],
			["level", { col: "level", regex: true }],
			["date", { col: "timestamp", date: true }]
		]);

		if (key === "level" && String(ast.value).toUpperCase() === "ALL") ast.value = "";

		const column = keyColumns.get(key);
		if (!column) return;

		const filter: Filter<Table> = {};
		if (column.date) {
			const op = logSearch.parseDate(ast);
			if (op && ast.isDate) filter[column.col] = op;
			else return;
		} else if (ast.isRegex) {
			filter.RAW = (table) => (column.regex ? sql`${table[column.col]}::text ~* ${ast.value}` : sql`1=0`);
		} else {
			filter.RAW = (table) => sql`${table[column.col]}::text ilike ${`%${ast.value}%`}`;
		}

		return filter;
	}
});
