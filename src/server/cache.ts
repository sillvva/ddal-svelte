import { REDIS_URL } from "$env/static/private";
import { Redis } from "ioredis";

const redis = new Redis(REDIS_URL);

/**
 * A cache key as an array of strings with at least one element.
 */
export type CacheKey = [string, ...string[]];

/**
 * Retrieves a cache from Redis or caches the results of a callback function.
 * @template TReturnType The return type of the callback function.
 * @param [callback] The callback function to cache.
 * @param [key] The cache key as an array of strings.
 * @param [expires=259200] The cache expiration time in seconds. Defaults to 3 days.
 * @returns The cached result of the callback function.
 */
export async function cache<TReturnType>(callback: () => Promise<TReturnType>, key: CacheKey, expires = 3 * 86400) {
	const rkey = key.join("|");
	const currentTime = Date.now();

	// Get the cache from Redis
	const cache = JSON.parse((await redis.get(rkey)) || "null") as { data: TReturnType; timestamp: number } | null;

	if (cache) {
		// Update the timestamp and reset the cache expiration
		cache.timestamp = currentTime;
		redis.setex(rkey, expires, JSON.stringify(cache));

		return cache.data;
	}

	// Call the callback function and cache the result
	const result = await callback();
	redis.setex(rkey, expires, JSON.stringify({ data: result, timestamp: currentTime }));
	return result;
}

/**
 * Retrieves caches from Redis or caches the results of a callback function for each key.
 * @template TReturnType The return type of the callback function.
 * @param [callback] The callback function to cache. The hits parameter is an array of cached results of the callback function for each key.
 * @param [keys] The cache keys as an array of arrays of strings.
 * @param [expires=259200] The cache expiration time in seconds. Defaults to 3 days.
 * @returns An array of cached results of the callback function for each key.
 */
export async function mcache<TReturnType>(
	callback: (keys: CacheKey[], hits: TReturnType[]) => Promise<Array<{ key: CacheKey; value: TReturnType }>>,
	keys: CacheKey[],
	expires = 3 * 86400
) {
	const joinedKeys = keys.map((t) => t.join("|"));

	// Get the caches from Redis
	const caches = await redis.mget(joinedKeys);
	const hits = caches.filter(Boolean) as string[];

	if (hits.length < keys.length) {
		// Call the mass callback function
		const results = await callback(
			keys,
			hits.map((t) => {
				const cache: { data: TReturnType; timestamp: number } = JSON.parse(t);
				return cache.data;
			})
		);

		// Update the results in the caches array
		for (const result of results) {
			const k = result.key.join("|");
			const index = joinedKeys.indexOf(k);
			if (index >= 0) caches[index] = JSON.stringify({ data: result.value, timestamp: Date.now() });
		}
	}

	const multi = redis.multi();
	const results: TReturnType[] = [];
	for (let i = 0; i < caches.length; i++) {
		const currentTime = Date.now();
		const value = caches[i];
		if (value) {
			try {
				const cache: { data: TReturnType; timestamp: number } = JSON.parse(value);

				// Update the timestamp and reset the cache expiration
				cache.timestamp = currentTime;
				multi.setex(joinedKeys[i], expires, JSON.stringify(cache));

				// Add the cached result to the results array
				results.push(cache.data);
				continue;
			} catch (e) {
				console.error(e);
			}
		}
	}

	multi.exec();

	// Return the results
	return results;
}

/**
 * Invalidates Redis caches based on an array of keys.
 * @param [keys] The cache keys as an array of arrays of strings. Empty strings, false, null, and undefined are ignored.
 */
export function revalidateKeys(keys: Array<CacheKey | "" | false | null | undefined>) {
	const cacheKeys = keys.filter((t) => Array.isArray(t) && t.length).map((t) => (t as string[]).join("|"));
	// console.log(cacheKeys);
	if (cacheKeys.length) redis.del(...cacheKeys);
}
