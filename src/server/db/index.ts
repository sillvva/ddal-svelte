import { privateEnv } from "$lib/env/private";
import * as schema from "$server/db/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const connection = postgres(privateEnv.DATABASE_URL, { prepare: false });

export const db = drizzle(connection, { schema });
export const q = db.query;
