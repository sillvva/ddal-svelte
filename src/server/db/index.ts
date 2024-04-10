import { privateEnv } from "$lib/env/private";
import * as schema from "$server/db/schema";
import { getTableColumns, sql, SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const connection = postgres(privateEnv.DATABASE_URL, { prepare: false });

export const db = drizzle(connection, { schema });
export const q = db.query;

export const buildConflictUpdateColumns = <T extends PgTable, Q extends keyof T["_"]["columns"]>(table: T, columns: Q[]) => {
	const cls = getTableColumns(table);
	return columns.reduce(
		(acc, column) => {
			if (!cls[column]) return acc;
			const colName = cls[column].name;
			acc[column] = sql.raw(`excluded.${colName}`);
			return acc;
		},
		{} as Record<Q, SQL>
	);
};
