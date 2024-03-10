import { privateEnv } from "$lib/env/private";
import * as schema from "$src/db/schema";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection(privateEnv.DATABASE_URL);

export const db = drizzle(connection, { schema, mode: "default" });
export const q = db.query;
