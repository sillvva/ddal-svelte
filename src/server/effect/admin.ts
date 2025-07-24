import type { AppLogId, AppLogSchema } from "$lib/schemas";
import { DBService, type Filter, type Transaction, type TRSchema } from "$server/db";
import type { relations } from "$server/db/relations";
import { appLogs, type AppLog } from "$server/db/schema";
import type { ASTNode, ParseMetadata } from "@sillvva/search";
import { DrizzleSearchParser } from "@sillvva/search/drizzle";
import { eq, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { isTupleOf } from "effect/Predicate";
import { FormError } from ".";

export class SaveAppLogError extends FormError<AppLogSchema> {}
function createSaveAppLogError(err: unknown): SaveAppLogError {
	return SaveAppLogError.from(err);
}

interface AdminApiImpl {
	readonly get: {
		readonly logs: (search?: string) => Effect.Effect<{ logs: AppLog[]; metadata: ParseMetadata; ast: ASTNode | null }>;
	};
	readonly set: {
		readonly deleteLog: (logId: AppLogId) => Effect.Effect<{ id: AppLogId }, SaveAppLogError>;
	};
}

export class AdminService extends Effect.Service<AdminService>()("AdminService", {
	effect: Effect.gen(function* () {
		const { db } = yield* DBService;

		const impl: AdminApiImpl = {
			get: {
				logs: (search = "") => {
					const { where, orderBy, metadata, ast } = logSearch.parse(search);

					return Effect.promise(() =>
						db.query.appLogs.findMany({
							where,
							orderBy: {
								...orderBy,
								timestamp: "desc"
							}
						})
					).pipe(Effect.andThen((logs) => ({ logs, metadata, ast })));
				}
			},
			set: {
				deleteLog: (logId) =>
					Effect.tryPromise({
						try: () => db.delete(appLogs).where(eq(appLogs.id, logId)).returning({ id: appLogs.id }),
						catch: createSaveAppLogError
					}).pipe(
						Effect.flatMap((logs) =>
							isTupleOf(logs, 1) ? Effect.succeed(logs[0]) : Effect.fail(new SaveAppLogError("Log not found", { status: 404 }))
						)
					)
			}
		};

		return impl;
	}),
	dependencies: [DBService.Default()]
}) {}

export const AdminTx = (tx: Transaction) => AdminService.DefaultWithoutDependencies.pipe(Layer.provide(DBService.Default(tx)));

export const withAdmin = Effect.fn("withAdmin")(
	<R, E extends SaveAppLogError>(impl: (service: AdminApiImpl) => Effect.Effect<R, E>) =>
		Effect.gen(function* () {
			const adminApi = yield* AdminService;
			return yield* impl(adminApi);
		}).pipe(Effect.provide(AdminService.Default))
);

type Table = "appLogs";
type Column = keyof TRSchema[Table]["columns"];

export const validKeys = ["id", "date", "label", "level", "user", "userId", "route", "routeId"] as const satisfies (
	| Column
	| (string & {})
)[];
const defaultKey = "label" as const satisfies (typeof validKeys)[number] & Column;

export const logSearch = new DrizzleSearchParser<typeof relations, Table>({
	validKeys,
	defaultKey,
	filterFn: (ast) => {
		const key = (ast.key || defaultKey) as (typeof validKeys)[number];

		if (key === "user" || key === "userId") {
			if (ast.isRegex) {
				return {
					RAW: (table) => sql`${table.annotations}->>'userId'::text ~* ${ast.value}`
				};
			}
			return {
				RAW: (table) => sql`${table.annotations}->>'userId'::text = ${ast.value}`
			};
		}

		if (key === "route" || key === "routeId") {
			if (ast.isRegex) {
				return {
					RAW: (table) => sql`${table.annotations}->>'routeId'::text ~* ${ast.value}`
				};
			}
			return {
				RAW: (table) => sql`${table.annotations}->'routeId'::text = ${ast.value}`
			};
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
