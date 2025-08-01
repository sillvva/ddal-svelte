import type { AppLogId, AppLogSchema } from "$lib/schemas";
import { DBService, query, type DrizzleError, type Filter, type Transaction, type TRSchema } from "$server/db";
import type { relations } from "$server/db/relations";
import { appLogs, type AppLog } from "$server/db/schema";
import type { ASTNode, ParseMetadata } from "@sillvva/search";
import { DrizzleSearchParser } from "@sillvva/search/drizzle";
import { eq, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { isTupleOf } from "effect/Predicate";
import { FormError, Log } from ".";

export class SaveAppLogError extends FormError<AppLogSchema> {}

export class DeleteLogError extends FormError<{ id: AppLogId }> {
	constructor(err?: unknown) {
		super("Unable to delete log", { status: 500, cause: err });
	}
}

interface AdminApiImpl {
	readonly get: {
		readonly logs: (
			search?: string
		) => Effect.Effect<{ logs: AppLog[]; metadata: ParseMetadata; ast: ASTNode | null }, DrizzleError>;
	};
	readonly set: {
		readonly deleteLog: (logId: AppLogId) => Effect.Effect<{ id: AppLogId }, DeleteLogError | DrizzleError>;
	};
}

export class AdminService extends Effect.Service<AdminService>()("AdminService", {
	effect: Effect.fn("AdminService")(function* () {
		const { db } = yield* DBService;

		const impl: AdminApiImpl = {
			get: {
				logs: Effect.fn("AdminService.get.logs")(function* (search = "") {
					const { where, orderBy, metadata, ast } = logSearch.parse(search);
					yield* Log.info("AdminService.get.logs", { where, orderBy, metadata, ast });

					return yield* query(
						db.query.appLogs.findMany({
							where,
							orderBy: {
								...orderBy,
								timestamp: "desc"
							}
						})
					).pipe(Effect.map((logs) => ({ logs, metadata, ast })));
				})
			},
			set: {
				deleteLog: Effect.fn("AdminService.set.deleteLog")(function* (logId) {
					return yield* query(db.delete(appLogs).where(eq(appLogs.id, logId)).returning({ id: appLogs.id })).pipe(
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

export const withAdmin = Effect.fn("withAdmin")(
	function* <R, E extends SaveAppLogError | DeleteLogError | DrizzleError>(impl: (service: AdminApiImpl) => Effect.Effect<R, E>) {
		const adminApi = yield* AdminService;
		return yield* impl(adminApi);
	},
	(effect) => effect.pipe(Effect.provide(AdminService.Default()))
);

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
