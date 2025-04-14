import { privateEnv } from "$lib/env/private";
import { relations } from "$server/db/relations";
import {
	getTableColumns,
	sql,
	type BuildQueryResult,
	type DBQueryConfig,
	type ExtractTablesWithRelations,
	type GetColumnData,
	type RelationsFilter,
	type SQL
} from "drizzle-orm";
import { type PgTable } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const connection = postgres(privateEnv.DATABASE_URL, { prepare: false });
export const db = drizzle(connection, { relations });
export const q = db.query;

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

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type TRSchema = ExtractTablesWithRelations<typeof relations>;
export type Filter<TableName extends keyof TRSchema> = RelationsFilter<TRSchema[TableName], TRSchema>;
export type QueryConfig<TableName extends keyof TRSchema> = DBQueryConfig<"one" | "many", TRSchema, TRSchema[TableName]>;
export type InferQueryModel<TableName extends keyof TRSchema, QBConfig extends QueryConfig<TableName> = {}> = BuildQueryResult<
	TRSchema,
	TRSchema[TableName],
	QBConfig
>;
