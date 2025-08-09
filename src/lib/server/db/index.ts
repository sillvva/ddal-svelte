import { privateEnv } from "$lib/env/private";
import { relations } from "$lib/server/db/relations";
import * as schema from "$lib/server/db/schema";
import { type ErrorClass, type ErrorParams } from "$lib/server/effect";
import {
	getTableColumns,
	sql,
	type BuildQueryResult,
	type DBQueryConfig,
	type ExtractTablesWithRelations,
	type GetColumnData,
	type Query,
	type RelationsFilter,
	type SQL
} from "drizzle-orm";
import type { PgTable, PgTransaction } from "drizzle-orm/pg-core";
import { drizzle, type PostgresJsDatabase, type PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { Cause, Data, Effect, Exit } from "effect";
import postgres from "postgres";
import type { EffectFailure, EffectResult } from "../effect/runtime";

export type Database = PostgresJsDatabase<typeof schema, typeof relations>;
export type Transaction = PgTransaction<PostgresJsQueryResultHKT, typeof schema, typeof relations>;

export const connection = postgres(privateEnv.DATABASE_URL, { prepare: false });
export const db: Database = drizzle(connection, { schema, relations });

export class DBService extends Effect.Service<DBService>()("DBService", {
	effect: Effect.fn("DBService")(function* (tx?: Transaction) {
		const transaction = Effect.fn("DBService.transaction")(function* <A, B extends InstanceType<ErrorClass> | never>(
			effect: (tx: Transaction) => Effect.Effect<A, B>
		) {
			const result: EffectResult<A> = yield* Effect.promise(() =>
				db.transaction(async (tx) => {
					const result = await Effect.runPromiseExit(effect(tx));
					return Exit.match(result, {
						onSuccess: (result) => ({ ok: true as const, data: result }),
						onFailure: (cause) =>
							({
								ok: false as const,
								error: {
									message: Cause.pretty(cause),
									status: 500,
									extra: {
										cause: cause
									}
								}
							}) satisfies EffectFailure
					});
				})
			);
			if (result.ok) return result.data;
			else return yield* new TransactionError(result.error);
		});

		return { db: tx || db, transaction };
	})
}) {}

export function runQuery<T>(query: PromiseLike<T> & { toSQL: () => Query }): Effect.Effect<T, DrizzleError> {
	return Effect.tryPromise({
		try: () => query,
		catch: (err) => new DrizzleError(err, query.toSQL())
	});
}

export class TransactionError extends Data.TaggedError("TransactionError")<ErrorParams> {
	constructor(err: unknown) {
		super({ message: Cause.pretty(Cause.fail(err)), status: 500, cause: err });
	}
}

export class DrizzleError extends Data.TaggedError("DrizzleError")<ErrorParams> {
	constructor(err: unknown, query: Query) {
		super({ message: Cause.pretty(Cause.fail(err)), status: 500, cause: err, query });
	}
}

export type TRSchema = ExtractTablesWithRelations<typeof relations>;
export type Filter<TableName extends keyof TRSchema> = RelationsFilter<TRSchema[TableName], TRSchema>;
export type QueryConfig<TableName extends keyof TRSchema, Type extends "one" | "many" = "one"> = DBQueryConfig<
	Type,
	TRSchema,
	TRSchema[TableName]
>;
export type InferQueryResult<
	TableName extends keyof TRSchema,
	QBConfig extends QueryConfig<TableName, Type> = object,
	Type extends "one" | "many" = "one"
> = BuildQueryResult<TRSchema, TRSchema[TableName], QBConfig>;

export function buildConflictUpdateColumns<
	Table extends PgTable,
	Columns extends keyof Table["_"]["columns"],
	Omit extends boolean = false
>(table: Table, columns: Columns[], omit: Omit = false as Omit) {
	const cls = getTableColumns(table);

	type Keys = Omit extends true ? Exclude<keyof Table["_"]["columns"], Columns> : Columns;
	const keys = Object.keys(cls).filter((key) => columns.includes(key as Columns) !== omit) as Keys[];

	return keys.reduce(
		(acc, column) => {
			const col = cls[column];
			if (!col) return acc;
			acc[column] = sql.raw(`excluded."${col.name}"`);
			return acc;
		},
		{} as { [key in Keys]: SQL<GetColumnData<Table["_"]["columns"][key]>> }
	);
}
