import { privateEnv } from "$lib/env/private";
import type { Falsy } from "$lib/util";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const delimiter = ":";

const redis = new Redis({
	url: privateEnv.UPSTASH_REDIS_REST_URL,
	token: privateEnv.UPSTASH_REDIS_REST_TOKEN
});
const limits = {
	fetch: createLimiter(600, "1 h"),
	update: createLimiter(180, "1 h"),
	insert: createLimiter(60, "1 h"),
	cache: createLimiter(18, "1 h")
} as const;

function createLimiter(limit: number, duration: `${number} ${"s" | "m" | "h"}`) {
	const limiter = Ratelimit.slidingWindow(limit, duration);
	return new Ratelimit({ redis, limiter, prefix: `@upstash${delimiter}ratelimit` });
}

export async function rateLimiter(type: keyof typeof limits, ...identifiers: string[]) {
	const { success, reset } = await limits[type].limit(identifiers.join(delimiter));
	return { success, reset };
}

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
	const rkey = key.join(delimiter);
	const currentTime = Date.now();

	// Get the cache from Redis
	type CachedType = { data: TReturnType; timestamp: number };
	const cache = await redis.get<CachedType>(rkey);

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
export async function mcache<TReturnType extends object>(
	callback: (keys: CacheKey[], hits: TReturnType[]) => Promise<Array<{ key: CacheKey; value: TReturnType }>>,
	keys: CacheKey[],
	expires = 3 * 86400
) {
	const joinedKeys = keys.map((t) => t.join(delimiter));

	// Get the caches from Redis
	type CachedType = { data: TReturnType; timestamp: number };
	const caches = await redis.mget<CachedType[]>(joinedKeys);
	const hits = caches.filter(Boolean);

	if (hits.length < keys.length) {
		// Call the mass callback function
		const results = await callback(
			keys,
			hits.map((item) => item.data)
		);

		// Update the results in the caches array
		for (const result of results) {
			const k = result.key.join(delimiter);
			const index = joinedKeys.indexOf(k);
			if (index >= 0) caches[index] = { data: result.value, timestamp: Date.now() };
		}
	}

	const multi = redis.multi();
	const results: TReturnType[] = [];
	for (let i = 0; i < caches.length; i++) {
		const currentTime = Date.now();
		const cache = caches[i];
		if (cache) {
			try {
				// Update the timestamp and reset the cache expiration
				cache.timestamp = currentTime;

				if (joinedKeys[i] === undefined) continue;
				multi.setex(joinedKeys[i]!, expires, cache);

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
export function revalidateKeys(keys: Array<CacheKey | Falsy>) {
	const cacheKeys = keys.filter((t) => Array.isArray(t) && t.length).map((t) => (t as string[]).join(delimiter));
	if (cacheKeys.length) redis.del(...cacheKeys);
}
