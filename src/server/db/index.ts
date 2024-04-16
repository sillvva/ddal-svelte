import * as schema from "$server/db/schema";
import { sql as vsql } from "@vercel/postgres";
import { getTableColumns, sql, SQL } from "drizzle-orm";
import { type PgTable } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/vercel-postgres";

export const db = drizzle(vsql, { schema });
export const q = db.query;

export const buildConflictUpdateColumns = <T extends PgTable, Q extends keyof T["_"]["columns"]>(table: T, columns: Q[]) => {
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
