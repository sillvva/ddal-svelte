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
	const cache = JSON.parse((await redis.get(key)) || "null") as { data: TReturnType; timestamp: number } | null;

	if (cache) {
		if (currentTime - cache.timestamp < 12 * 3600 * 1000) {
			cache.timestamp = currentTime;
			redis.setex(key, revalidate, JSON.stringify(cache));
		}

		if (cache && cache.data) return cache.data;
	}

	const result = await callback();
	redis.setex(key, revalidate, JSON.stringify({ data: result, timestamp: currentTime }));
	return result;
}

export async function mcache<TReturnType>(
	callback: (tags: [string, ...string[]]) => Promise<TReturnType>,
	tags: [string, ...string[]][],
	revalidate = 3 * 86400
) {
	const keys = tags.map((t) => t.join("|"));
	const caches = await redis.mget(keys);
	const results: TReturnType[] = [];
	for (let i = 0; i < caches.length; i++) {
		const currentTime = Date.now();
		const cacheString = caches[i];
		if (cacheString) {
			const cache: { data: TReturnType; timestamp: number } = JSON.parse(cacheString);

			if (currentTime - cache.timestamp < 12 * 3600 * 1000) {
				cache.timestamp = currentTime;
				redis.setex(keys[i], revalidate, cacheString);
			}

			if (cache.data) results[i] = cache.data;
			continue;
		}

		const result = await callback(tags[i]);
		redis.setex(keys[i], revalidate, JSON.stringify({ data: result, timestamp: currentTime }));
		results[i] = result;
	}

	return results;
}

export function revalidateTags(tags: Array<[string, ...string[]] | string[] | "" | false | null | undefined>) {
	redis.del(...tags.filter((t) => Array.isArray(t) && t.length).map((t) => (t as Array<string>).join("|")));
}
