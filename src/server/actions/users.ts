import { revalidateKeys, type CacheKey } from "../cache";
import { getCharactersCache } from "../data/characters";

export async function clearUserCache(userId: string) {
	const characters = await getCharactersCache(userId);

	revalidateKeys([
		["dms", userId, "logs"],
		["characters", userId],
		...characters.map((c) => ["character", c.id, "logs"] as CacheKey),
		["dm-logs", userId]
	]);
}
