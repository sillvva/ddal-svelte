// src/server/db/client.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
	// log: env.NODE_ENV !== "production" ? ["query"] : [],
});
