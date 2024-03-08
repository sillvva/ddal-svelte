// src/server/db/client.ts
import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client/edge";

// Setup
const connectionString = `${process.env.TURSO_DATABASE_URL}`;
const authToken = `${process.env.TURSO_AUTH_TOKEN}`;

// Init prisma client
const libsql = createClient({
	url: connectionString,
	authToken
});
const adapter = new PrismaLibSQL(libsql);

export const prisma = new PrismaClient({
	// log: dev ? ["query"] : [],
	adapter
});
