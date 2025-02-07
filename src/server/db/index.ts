import { privateEnv } from "$lib/env/private";
import * as schema from "$server/db/schema";
import {
	getTableColumns,
	sql,
	type BuildQueryResult,
	type DBQueryConfig,
	type ExtractTablesWithRelations,
	type GetColumnData,
	type SQL
} from "drizzle-orm";
import { type PgTable } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const connection = postgres(privateEnv.DATABASE_URL, { prepare: false });
export const db = drizzle(connection, { schema });
export const q = db.query;

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function buildConflictUpdateColumns<T extends PgTable, Q extends keyof T["_"]["columns"]>(table: T, columns: Q[]) {
	const cls = getTableColumns(table);
	return columns.reduce(
		(acc, column) => {
			const col = cls[column];
			if (!col) return acc;
			const colName = col.name;
			acc[column] = sql.raw(`excluded.${colName}`) as SQL<(typeof col)["_"]["data"]>;
			return acc;
		},
		{} as Record<Q, SQL<GetColumnData<T["_"]["columns"][Q]>>>
	);
}

type TSchema = ExtractTablesWithRelations<typeof schema>;
export type QueryConfig<TableName extends keyof TSchema> = DBQueryConfig<"one" | "many", boolean, TSchema, TSchema[TableName]>;
export type InferQueryModel<TableName extends keyof TSchema, QBConfig extends QueryConfig<TableName> = {}> = BuildQueryResult<
	TSchema,
	TSchema[TableName],
	QBConfig
>;
