import { privateEnv } from "$lib/env/private";
import * as schema from "$src/db/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const client = postgres(privateEnv.DATABASE_URL);

export const db = drizzle(client, { schema });
export const q = db.query;
