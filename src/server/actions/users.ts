import type { PROVIDERS } from "$lib/constants";
import type { UserId } from "$lib/schemas";
import { rateLimiter, revalidateKeys, type CacheKey } from "$server/cache";
import { getCharactersCache } from "$server/data/characters";
import { db } from "$server/db";
import { accounts } from "$server/db/schema";
import { error } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";

export async function clearUserCache(userId: UserId) {
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
export async function unlinkProvider(userId: UserId, provider: ProviderId) {
	try {
		const result = await db.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)));
		return result.count > 0;
	} catch (e) {
		throw new Error("Could not unlink account");
	}
}
