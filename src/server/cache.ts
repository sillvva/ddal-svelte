import { REDIS_URL } from "$env/static/private";
import { Redis } from "ioredis";

const redis = new Redis(REDIS_URL);

export type CacheKey = [string, ...string[]];

export async function cache<TReturnType>(callback: () => Promise<TReturnType>, key: CacheKey, revalidate = 3 * 86400) {
	const rkey = key.join("|");
	const currentTime = Date.now();
	const cache = JSON.parse((await redis.get(rkey)) || "null") as { data: TReturnType; timestamp: number } | null;

	if (cache) {
		if (revalidate * 1000 - currentTime + cache.timestamp < 8 * 3600 * 1000) {
			cache.timestamp = currentTime;
			redis.setex(rkey, revalidate, JSON.stringify(cache));
		}

		return cache.data;
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
	const results: Array<TReturnType> = [];

	for (let i = 0; i < caches.length; i++) {
		const currentTime = Date.now();
		const cacheString = caches[i];
		if (cacheString) {
			const cache: { data: TReturnType; timestamp: number } = JSON.parse(cacheString);

			if (revalidate * 1000 - currentTime + cache.timestamp < 8 * 3600 * 1000) {
				cache.timestamp = currentTime;
				redis.setex(keys[i], revalidate, cacheString);
			}

			results[i] = cache.data;
			continue;
		}

		const result = await callback(key[i]);
		redis.setex(keys[i], revalidate, JSON.stringify({ data: result, timestamp: currentTime }));
		results[i] = result;
	}

	return results;
}

export function revalidateTags(keys: Array<CacheKey | "" | false | null | undefined>) {
	const cacheKeys = keys.filter((t) => Array.isArray(t) && t.length).map((t) => (t as string[]).join("|"));
	if (cacheKeys.length) redis.del(...cacheKeys);
}
