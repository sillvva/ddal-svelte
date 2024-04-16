import * as schema from "$server/kv/schema";
import Database from "better-sqlite3";
import { getTableColumns, SQL, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

const sqlite = new Database("./kv.db");
export const kv = drizzle(sqlite, { schema });

export const buildConflictUpdateColumns = <T extends SQLiteTable, Q extends keyof T["_"]["columns"]>(table: T, columns: Q[]) => {
	const cls = getTableColumns(table);
	return columns.reduce(
		(acc, column) => {
			const col = cls[column];
			if (!col) return acc;
			const colName = col.name;
			acc[column] = sql.raw(`excluded.${colName}`) as SQL<(typeof col)["_"]["data"]>;
			return acc;
		},
		{} as Record<Q, SQL<(typeof cls)[Q]["_"]["data"]>>
	);
};
