/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from "$service-worker";

const sw = self as unknown as ServiceWorkerGlobalScope;

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;

const EXCLUDE = ["/auth"];

const ASSETS = [
	...build, // the app itself
	...files // everything in `static`
];

sw.addEventListener("install", (event) => {
	// Create a new cache and add all files to it
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

sw.addEventListener("activate", (event) => {
	// Remove previous cached data from disk
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

sw.addEventListener("fetch", (event) => {
	// ignore POST requests etc
	if (event.request.method !== "GET") return;

	async function respond() {
		const url = new URL(event.request.url);

		// don't cache requests to excluded paths
		if (EXCLUDE.some((path) => url.pathname.startsWith(path))) {
			return await fetch(event.request);
		}

		const cache = await caches.open(CACHE);

		// `build`/`files` can always be served from the cache
		if (ASSETS.includes(url.pathname)) {
			const result = await cache.match(url.pathname);
			return result || new Response(null, { status: 404 });
		}

		// for everything else, try the network first, but
		// fall back to the cache if we're offline
		try {
			const response = await fetch(event.request);

			if (response.status === 200 && !event.request.url.startsWith("chrome-extension:")) {
				cache.put(event.request, response.clone());
			}

			return response;
		} catch {
			const result = await cache.match(event.request);
			return result || new Response(null, { status: 404 });
		}
	}

	event.respondWith(respond());
});
