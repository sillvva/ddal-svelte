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
 * @param {() => Promise<TReturnType>} callback The callback function to cache.
 * @param {CacheKey} key The cache key as an array of strings.
 * @param {number} [expires=259200] The cache expiration time in seconds. Defaults to 3 days.
 * @returns {Promise<TReturnType>} The cached result of the callback function.
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
 * @param {(key: CacheKey) => Promise<TReturnType>} [callback] The callback function to cache.
 * @param {CacheKey[]} [key] The cache keys as an array of arrays of strings.
 * @param options The options for the mcache function.
 * @param {(keys: CacheKey[]) => Promise<Array<{ key: CacheKey; value: TReturnType }>} [options.massCallback]
 * The mass callback function to cache. If provided, this function is called instead of the callback function if any of the caches are missing.
 * @param {number} [options.expires=259200] The cache expiration time in seconds. Defaults to 3 days.
 * @returns {Promise<TReturnType[]>} An array of cached results of the callback function for each key.
 */
export async function mcache<TReturnType>(
	callback: (key: CacheKey) => Promise<TReturnType>,
	key: CacheKey[],
	options: {
		/**
		 * The mass callback function to cache. If provided, this function is called instead of the callback function if any of the caches are missing.
		 * @param keys The cache keys as an array of arrays of strings with at least one element.
		 * @returns An array of cached results of the callback function for each key.
		 */
		massCallback?: (keys: CacheKey[], hits: TReturnType[]) => Promise<Array<{ key: CacheKey; value: TReturnType }>>;
		/**
		 * The cache expiration time in seconds. Defaults to 3 days.
		 */
		expires?: number;
	}
) {
	const { massCallback, expires = 3 * 86400 } = options;

	const keys = key.map((t) => t.join("|"));

	// Get the caches from Redis
	const caches = await redis.mget(keys);
	const hits = caches.filter(Boolean) as string[];

	if (massCallback && hits.length < key.length) {
		// Call the mass callback function
		const results = await massCallback(
			key,
			hits.map((t) => {
				const cache: { data: TReturnType; timestamp: number } = JSON.parse(t);
				return cache.data;
			})
		);

		// Update the results in the caches array
		for (const result of results) {
			const k = result.key.join("|");
			const index = keys.indexOf(k);
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
				multi.setex(keys[i], expires, JSON.stringify(cache));

				// Add the cached result to the results array
				results.push(cache.data);
				continue;
			} catch (e) {
				console.error(e);
			}
		}

		// Call the callback function and cache the result
		const result = await callback(key[i]);
		multi.setex(keys[i], expires, JSON.stringify({ data: result, timestamp: currentTime }));

		// Add the result to the results array
		results.push(result);
	}

	multi.exec();

	// Return the results
	return results;
}

/**
 * Invalidates Redis caches based on an array of keys.
 * @param {Array<CacheKey | "" | false | null | undefined>} keys The cache keys as an array of arrays of strings. Empty strings, false, null, and undefined are ignored.
 * @returns {void}
 */
export function revalidateKeys(keys: Array<CacheKey | "" | false | null | undefined>) {
	const cacheKeys = keys.filter((t) => Array.isArray(t) && t.length).map((t) => (t as string[]).join("|"));
	// console.log(cacheKeys);
	if (cacheKeys.length) redis.del(...cacheKeys);
}
