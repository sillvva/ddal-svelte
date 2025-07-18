import { privateEnv } from "$lib/env/private";
import { relations } from "$server/db/relations";
import * as schema from "$server/db/schema";
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
import type { PgTable, PgTransaction } from "drizzle-orm/pg-core";
import { drizzle, type PostgresJsDatabase, type PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const connection = postgres(privateEnv.DATABASE_URL, { prepare: false });
export const db = drizzle(connection, { schema, relations });
export const q = db.query;

export type Database = PostgresJsDatabase<typeof schema, typeof relations>;
export type Transaction = PgTransaction<PostgresJsQueryResultHKT, typeof schema, typeof relations>;

export type TRSchema = ExtractTablesWithRelations<typeof relations>;
export type Filter<TableName extends keyof TRSchema> = RelationsFilter<TRSchema[TableName], TRSchema>;
export type QueryConfig<TableName extends keyof TRSchema, Type extends "one" | "many" = "one"> = DBQueryConfig<
	Type,
	TRSchema,
	TRSchema[TableName]
>;
export type InferQueryResult<
	TableName extends keyof TRSchema,
	QBConfig extends QueryConfig<TableName, Type> = {},
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
