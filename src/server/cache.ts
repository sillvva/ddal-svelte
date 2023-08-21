import { REDIS_URL } from "$env/static/private";
import { Redis } from "ioredis";

const redis = new Redis(REDIS_URL);

export type CacheKey = [string, ...string[]];

export async function cache<TReturnType>(callback: () => Promise<TReturnType>, key: CacheKey, revalidate = 3 * 86400) {
	const rkey = key.join("|");
	const currentTime = Date.now();
	const cache = JSON.parse((await redis.get(rkey)) || "null") as { data: TReturnType; timestamp: number } | null;

	if (cache) {
		if (currentTime - cache.timestamp < 12 * 3600 * 1000) {
			cache.timestamp = currentTime;
			redis.setex(rkey, revalidate, JSON.stringify(cache));
		}

		if (cache && cache.data) return cache.data;
	}

	const result = await callback();
	redis.setex(rkey, revalidate, JSON.stringify({ data: result, timestamp: currentTime }));
	return result;
}

export async function mcache<TReturnType>(
	callback: (key: CacheKey) => Promise<TReturnType>,
	key: Array<CacheKey>,
	revalidate = 3 * 86400
) {
	const keys = key.map((t) => t.join("|"));
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

		const result = await callback(key[i]);
		redis.setex(keys[i], revalidate, JSON.stringify({ data: result, timestamp: currentTime }));
		results[i] = result;
	}

	return results;
}

export function revalidateTags(key: Array<CacheKey | "" | false | null | undefined>) {
	redis.del(...key.filter((t) => Array.isArray(t) && t.length).map((t) => (t as Array<string>).join("|")));
}
