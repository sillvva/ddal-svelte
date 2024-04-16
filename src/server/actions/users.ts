import type { PROVIDERS } from "$lib/constants";
import type { UserId } from "$lib/schemas";
import { getCharactersCache } from "$server/data/characters";
import { db } from "$server/db";
import { accounts } from "$server/db/schema";
import { rateLimiter, revalidateLike } from "$server/kv/cache";
import { error } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";

export async function clearUserCache(userId: UserId) {
	const success = await rateLimiter("cache", userId);
	if (!success) error(429, "Too many requests");

	const characters = await getCharactersCache(userId);

	await revalidateLike(characters.map((c) => c.id as string).concat([userId]));
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
