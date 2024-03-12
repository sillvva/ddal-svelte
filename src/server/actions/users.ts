import type { PROVIDERS } from "$lib/constants";
import { accounts } from "$src/db/schema";
import { error } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { rateLimiter, revalidateKeys, type CacheKey } from "../cache";
import { getCharactersCache } from "../data/characters";
import { db } from "../db";

export async function clearUserCache(userId: string) {
	const { success } = await rateLimiter("cache", "cache-clear", userId);
	if (!success) error(429, "Too many requests");

	const characters = await getCharactersCache(userId);

	revalidateKeys([
		["dms", userId, "logs"],
		["characters", userId],
		...characters.map((c) => ["character", c.id, "logs"] as CacheKey),
		...characters.map((c) => ["character", c.id, "no-logs"] as CacheKey),
		["dm-logs", userId],
		["search-data", userId]
	]);
}

export type ProviderId = (typeof PROVIDERS)[number]["id"];
export async function unlinkProvider(userId: string, provider: ProviderId) {
	try {
		const result = await db.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)));
		return result.count > 0;
	} catch (e) {
		throw new Error("Could not unlink account");
	}
}
