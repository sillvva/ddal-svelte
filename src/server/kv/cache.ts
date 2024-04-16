import { dev } from "$app/environment";
import { isDefined, type Falsy } from "$lib/util";
import { and, eq, inArray, like, lt, notLike, or, SQL } from "drizzle-orm";
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
		.where(and(inArray(cacheTable.key, joinedKeys)));
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

export async function revalidateLike(keys: Array<CacheKey | string | Falsy>) {
	if (!keys.length) return;
	const cacheKeys = keys
		.filter((t): t is CacheKey | string => (Array.isArray(t) || typeof t === "string") && !!t.length)
		.map((t) => (Array.isArray(t) ? t.join(delimiter) : t));

	const filters: SQL<unknown>[] = [];
	for (let i = 0; i < cacheKeys.length; i++) {
		const key = cacheKeys[i];
		if (key) {
			filters.push(like(cacheTable.key, `%${key}%`));
		}
	}

	await kv.delete(cacheTable).where(and(or(...filters), notLike(cacheTable.key, `${limitKey}:%`)));
}

const limitKey = "limit";
const limits = {
	update: 180,
	insert: 60,
	delete: 60,
	cache: 30
};

export async function rateLimiter(type: keyof typeof limits, ...identifiers: string[]) {
	if (dev) return true;

	const limit = limits[type];
	const key = [limitKey, ...identifiers, type].join(delimiter);
	const ttl = new Date(Date.now() + 3600 * 1000);

	const [cache] = await kv
		.select()
		.from(cacheTable)
		.where(and(eq(cacheTable.key, key)))
		.limit(1);

	const counter = cache ? (JSON.parse(cache.value) as number) : 0;
	if (counter >= limit) return false;

	await kv
		.insert(cacheTable)
		.values({ key, value: JSON.stringify(counter + 1), ttl })
		.onConflictDoUpdate({
			target: cacheTable.key,
			set: buildConflictUpdateColumns(cacheTable, ["value"])
		});

	return true;
}
