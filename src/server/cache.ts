import { REDIS_URL } from "$env/static/private";
import { Redis } from "ioredis";

export const redis = new Redis(REDIS_URL);

export async function cache<TReturnType>(
	callback: () => Promise<TReturnType>,
	tags: [string, ...string[]],
	revalidate = 3 * 86400
) {
	const key = tags.join("|");
	const currentTime = Date.now();
	const cache = JSON.parse((await redis.get(key)) || "null") as {
		data: TReturnType;
		timestamp: number;
		revalidate: number;
	} | null;
	if (cache) {
		if (currentTime - cache.timestamp < 12 * 3600 * 1000) {
			cache.timestamp = currentTime;
			redis.setex(key, revalidate, JSON.stringify(cache));
		}

		if (cache && cache.data) return cache.data;
	}

	const result = await callback();
	redis.setex(key, revalidate, JSON.stringify({ data: result, timestamp: currentTime, revalidate }));
	return result;
}

export function revalidateTags(tags: [string, ...string[]]) {
	const key = tags.join("|");
	redis.del(key);
}
