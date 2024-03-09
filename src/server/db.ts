// src/server/db/client.ts
import { privateEnv } from "$lib/env/private";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";

export const prisma = new PrismaClient({
	// log: dev ? ["query"] : [],
	datasources: {
		db: {
			url: privateEnv.DATABASE_URL
		}
	}
}).$extends(withAccelerate());
