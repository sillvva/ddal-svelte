// src/server/db/client.ts
import { privateEnv } from "$lib/env/private";
import * as schema from "$src/db/schema";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

// Init prisma client
const libsql = createClient({
	url: privateEnv.TURSO_DATABASE_URL,
	authToken: privateEnv.TURSO_AUTH_TOKEN
});

export const db = drizzle(libsql, { schema });
export const q = db.query;
