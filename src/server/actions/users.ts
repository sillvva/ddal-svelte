import type { PROVIDERS } from "$lib/constants";
import type { UserId } from "$lib/schemas";
import { rateLimiter, revalidateKeys, type CacheKey } from "$server/cache";
import { getCharactersCache } from "$server/data/characters";
import { getUserDMs } from "$server/data/dms";
import { db, type QueryConfig } from "$server/db";
import { accounts } from "$server/db/schema";
import { error } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";

export const userIncludes = {
	columns: {
		id: true,
		name: true
	}
} as const satisfies QueryConfig<"users">;

export async function clearUserCache(user: LocalsSession["user"], limited = false) {
	if (limited) {
		const { success } = await rateLimiter("cache", user.id);
		if (!success) error(429, "Too many requests");
	}

	const characters = await getCharactersCache(user.id);
	const dsm = await getUserDMs(user);

	await revalidateKeys(
		characters
			.map((c) => ["character", c.id, "logs"] as CacheKey)
			.concat(characters.map((c) => ["character", c.id, "no-logs"] as CacheKey))
			.concat(dsm.map((dm) => ["dms", dm.id, "logs"] as CacheKey))
			.concat(dsm.map((dm) => ["dms", dm.id] as CacheKey))
			.concat([
				["dms", user.id],
				["dms", user.id, "logs"],
				["characters", user.id],
				["dm-logs", user.id],
				["search-data", user.id]
			])
	);
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
