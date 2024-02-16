import type { providers } from "$lib/components/Settings.svelte";
import { revalidateKeys, type CacheKey } from "../cache";
import { getCharactersCache } from "../data/characters";
import { prisma } from "../db";

export async function clearUserCache(userId: string) {
	const characters = await getCharactersCache(userId);

	revalidateKeys([
		["dms", userId, "logs"],
		["characters", userId],
		...characters.map((c) => ["character", c.id, "logs"] as CacheKey),
		["dm-logs", userId]
	]);
}

export type ProviderId = (typeof providers)[number]["id"];
export async function unlinkProvider(userId: string, provider: ProviderId) {
	try {
		await prisma.account.deleteMany({
			where: { userId, provider }
		});

		return true;
	} catch (e) {
		throw new Error("Could not unlink account");
	}
}
