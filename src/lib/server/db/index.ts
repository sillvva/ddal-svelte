import { getRequestEvent } from "$app/server";
import { privateEnv } from "#lib/env/private.js";
import { relations } from "#lib/server/db/relations.js";
import { isTaggedError, type ErrorClass, type ErrorParams } from "#lib/server/effect/errors.js";
import {
	getColumns,
	sql,
	type BuildQueryResult,
	type DBQueryConfig,
	type GetColumnData,
	type Query,
	type RelationsFilter,
	type SQL
} from "drizzle-orm";
import type { PgAsyncTransaction, PgTable } from "drizzle-orm/pg-core";
import { drizzle, type PostgresJsDatabase, type PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { Cause, Context, Data, Effect, Exit, Layer } from "effect";
import postgres from "postgres";

export type TRSchema = typeof relations;
export type Database = PostgresJsDatabase<TRSchema>;
export type Transaction = PgAsyncTransaction<PostgresJsQueryResultHKT, TRSchema>;

const client = postgres(privateEnv.DATABASE_URL, { prepare: false });
const db = drizzle({ client, relations });

export class DBService extends Context.Service<DBService>()("DBService", {
	make: Effect.fn("DBService")(function* (tx?: Transaction) {
		const database = tx || db;

		const transaction = Effect.fn("DBService.transaction")(function* <
			A,
			E extends InstanceType<ErrorClass>,
			Y extends Effect.Effect<A, E>
		>(program: (tx: Transaction) => Generator<Y, A>) {
			const event = getRequestEvent();
			const runtime = event.locals.runtime;
			const result = yield* Effect.tryPromise({
				try: () =>
					database.transaction(async (tx) => {
						const effect = Effect.gen(function* (): Effect.fn.Return<A, E> {
							return yield* program(tx);
						});
						const exit = await runtime.runPromiseExit(effect);
						return Exit.match(exit, {
							onSuccess: (value) => value,
							onFailure: (cause) => {
								const fail = cause.reasons.find(Cause.isFailReason);
								throw fail ? fail.error : new TransactionError(cause);
							}
						});
					}),
				catch: (error) => {
					if (isTaggedError(error)) return error as E | TransactionError;
					return new TransactionError(Cause.fail(error)); // Unexpected defects
				}
			});
			return result;
		});

		return { db: database, transaction };
	})
}) {
	static layer(tx?: Transaction) {
		return Layer.effect(this, this.make(tx));
	}

	static async end() {
		await client.end();
	}
}

export function runQuery<T>(query: PromiseLike<T> & { toSQL: () => Query }) {
	return Effect.tryPromise({
		try: () => query,
		catch: (err) => new DrizzleError(err, query.toSQL())
	});
}

export class TransactionError extends Data.TaggedError("TransactionError")<ErrorParams> {
	constructor(cause: Cause.Cause<unknown>) {
		super({ message: Cause.pretty(cause), status: 500, cause });
	}
}

interface DrizzleErrorParams extends ErrorParams {
	query: Query;
}

export class DrizzleError extends Data.TaggedError("DrizzleError")<DrizzleErrorParams> {
	constructor(err: unknown, query: Query) {
		super({ message: Cause.pretty(Cause.isCause(err) ? err : Cause.fail(err)), status: 500, cause: err, query });
	}
}

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
	const cls = getColumns(table);

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
