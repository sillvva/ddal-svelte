import { dev } from "$app/environment";
import { isDefined, type Falsy } from "$lib/util";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { buildConflictUpdateColumns, kv } from ".";
import { cacheTable } from "./schema";

const delimiter = ":";

/**
 * A cache key as an array of strings with at least one element.
 */
export type CacheKey = [string, ...string[]];

const clearExpired = () => kv.delete(cacheTable).where(lt(cacheTable.ttl, new Date()));

/**
 * Retrieves a cache from Redis or caches the results of a callback function.
 * @template TReturnType The return type of the callback function.
 * @param [callback] The callback function to cache.
 * @param [key] The cache key as an array of strings.
 * @param [expires=259200] The cache expiration time in seconds. Defaults to 3 days.
 * @returns The cached result of the callback function.
 */
export async function cache<TReturnType>(callback: () => Promise<TReturnType>, key: CacheKey, expires = 3 * 86400) {
	const joinedKey = key.join(delimiter);
	const currentTime = new Date();
	const newTime = new Date(currentTime.getTime() + expires * 1000);

	await clearExpired();

	// Get the cache from Redis
	const [cache] = await kv
		.select()
		.from(cacheTable)
		.where(and(eq(cacheTable.key, joinedKey)))
		.limit(1);

	if (cache) {
		const value = JSON.parse(cache.value) as TReturnType;

		// Update the timestamp and reset the cache expiration
		await kv.update(cacheTable).set({ ttl: newTime }).where(eq(cacheTable.key, joinedKey));

		return value;
	}

	// Call the callback function and cache the result
	const result = await callback();
	await kv.insert(cacheTable).values({ key: joinedKey, value: JSON.stringify(result), ttl: newTime });
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
	const currentTime = new Date();
	const newTime = new Date(currentTime.getTime() + expires * 1000);

	await clearExpired();

	// Get the caches from Redis
	let caches = await kv
		.select()
		.from(cacheTable)
		.where(and(inArray(cacheTable.key, joinedKeys), gte(cacheTable.ttl, new Date())));
	const hits = caches.map((hit) => ({
		...hit,
		value: JSON.parse(hit.value) as TReturnType,
		ttl: newTime
	}));

	if (hits.length < keys.length) {
		// Call the mass callback function
		const results = await callback(
			keys,
			hits.map((item) => item.value)
		).then((results) =>
			results.map((result) => ({ key: result.key.join(delimiter), value: JSON.stringify(result.value), ttl: newTime }))
		);

		const values = caches.concat(results);

		// Update the results in the caches array
		caches = joinedKeys
			.map((key) => {
				const index = values.findIndex((value) => value.key === key);
				return index >= 0 ? values[index] : undefined;
			})
			.filter(isDefined);
	}

	// Cache the results
	await kv
		.insert(cacheTable)
		.values(caches)
		.onConflictDoUpdate({
			target: cacheTable.key,
			set: buildConflictUpdateColumns(cacheTable, ["value", "ttl"])
		});

	// Return the results
	return caches.map((c) => JSON.parse(c.value) as TReturnType);
}

/**
 * Invalidates Redis caches based on an array of keys.
 * @param [keys] The cache keys as an array of arrays of strings. Empty strings, false, null, and undefined are ignored.
 */
export async function revalidateKeys(keys: Array<CacheKey | Falsy>) {
	const cacheKeys = keys.filter((t): t is CacheKey => Array.isArray(t) && !!t.length).map((t) => t.join(delimiter));
	if (cacheKeys.length) await kv.delete(cacheTable).where(inArray(cacheTable.key, cacheKeys));
}

const limits = {
	update: { limit: 180, durationS: 60 },
	insert: { limit: 60, durationS: 60 },
	delete: { limit: 60, durationS: 60 }
} as const;

export async function rateLimiter(type: keyof typeof limits, ...identifiers: string[]) {
	if (dev) return { success: true };

	const limit = limits[type];
	const counter = await cache(async () => 0, ["rate-limit", ...identifiers], limit.durationS);

	return counter < limit.limit;
}
