import { REDIS_URL } from "$env/static/private";
import { Redis } from "ioredis";

const redis = new Redis(REDIS_URL);

export type CacheKey = [string, ...string[]];

/**
 * Retrieves a cache from Redis or caches the results of a callback function.
 * @template TReturnType The return type of the callback function.
 * @param {() => Promise<TReturnType>} callback The callback function to cache.
 * @param {CacheKey} key The cache key as an array of strings.
 * @param {number} [expires=259200] The cache expiration time in seconds. Defaults to 3 days.
 * @returns {Promise<TReturnType>} The cached result of the callback function.
 */
export async function cache<TReturnType>(callback: () => Promise<TReturnType>, key: CacheKey, expires = 3 * 86400) {
	const rkey = key.join("|");
	const currentTime = Date.now();
	const cache = JSON.parse((await redis.get(rkey)) || "null") as { data: TReturnType; timestamp: number } | null;

	if (cache) {
		cache.timestamp = currentTime;
		redis.setex(rkey, expires, JSON.stringify(cache));

		return cache.data;
	}

	const result = await callback();
	redis.setex(rkey, expires, JSON.stringify({ data: result, timestamp: currentTime }));
	return result;
}

/**
 * Retrieves caches from Redis or caches the results of a callback function for each key.
 * @template TReturnType The return type of the callback function.
 * @param {(key: CacheKey) => Promise<TReturnType>} callback The callback function to cache.
 * @param {Array<CacheKey>} key The cache keys as an array of arrays of strings.
 * @param {number} [expires=259200] The cache expiration time in seconds. Defaults to 3 days.
 * @returns {Promise<Array<TReturnType>>} An array of cached results of the callback function for each key.
 */
export async function mcache<TReturnType>(
	callback: (key: CacheKey) => Promise<TReturnType>,
	key: Array<CacheKey>,
	expires = 3 * 86400
) {
	const keys = key.map((t) => t.join("|"));
	const caches = await redis.mget(keys);
	const results: Array<TReturnType> = [];

	for (let i = 0; i < caches.length; i++) {
		const currentTime = Date.now();
		const value = caches[i];
		if (value) {
			const cache: { data: TReturnType; timestamp: number } = JSON.parse(value);
			cache.timestamp = currentTime;
			redis.setex(keys[i], expires, JSON.stringify(cache));

			results[i] = cache.data;
			continue;
		}

		const result = await callback(key[i]);
		redis.setex(keys[i], expires, JSON.stringify({ data: result, timestamp: currentTime }));
		results[i] = result;
	}

	return results;
}

/**
 * Invalidates Redis cache based on an array of cache keys.
 * @param {Array<CacheKey | "" | false | null | undefined>} keys The cache keys as an array of arrays of strings. Empty strings, false, null, and undefined are ignored.
 * @returns {void}
 */
export function revalidateKeys(keys: Array<CacheKey | "" | false | null | undefined>) {
	const cacheKeys = keys.filter((t) => Array.isArray(t) && t.length).map((t) => (t as string[]).join("|"));
	if (cacheKeys.length) redis.del(...cacheKeys);
}
