const dataCache = new Map<string, { data: unknown; timestamp: number; revalidate: number }>();

export async function cache<TReturnType>(
	callback: () => Promise<TReturnType>,
	tags: [string, ...string[]],
	revalidate = 3 * 86400
) {
	clearOldCaches();

	const key = tags.join("|");
	const currentTime = Date.now();
	const dCache = dataCache.get(key) as { data: TReturnType; timestamp: number; revalidate: number } | undefined;
	if (dCache && dCache.data) return dCache.data;

	const result = await callback();
	dataCache.set(key, { data: result, timestamp: currentTime, revalidate });
	return result;
}

export function revalidateTags(tags: [string, ...string[]]) {
	const key = tags.join("|");
	dataCache.delete(key);
}

export function clearOldCaches() {
	const currentTime = Date.now();
	for (const [key, value] of dataCache.entries()) {
		if (currentTime - value.timestamp > value.revalidate * 1000) dataCache.delete(key);
	}
}
