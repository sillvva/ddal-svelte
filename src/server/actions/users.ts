import type { PROVIDERS } from "$lib/constants";
import { SaveError } from "$lib/schemas";
import { error } from "@sveltejs/kit";
import { rateLimiter, revalidateKeys, type CacheKey } from "../cache";
import { getCharactersCache } from "../data/characters";
import { prisma } from "../db";

export async function clearUserCache(userId: string) {
	const { success } = await rateLimiter("cache-clear", userId);
	if (!success) error(429, "Too many requests");

	const characters = await getCharactersCache(userId);

	revalidateKeys([
		["dms", userId, "logs"],
		["characters", userId],
		...characters.map((c) => ["character", c.id, "logs"] as CacheKey),
		["dm-logs", userId],
		["search-data", userId]
	]);
}

export type ProviderId = (typeof PROVIDERS)[number]["id"];
export async function unlinkProvider(userId: string, provider: ProviderId) {
	try {
		const { success } = await rateLimiter("unlink-provider", userId);
		if (!success) throw new SaveError(429, "Too many requests");

		await prisma.account.deleteMany({
			where: { userId, provider }
		});

		return true;
	} catch (e) {
		throw new Error("Could not unlink account");
	}
}
