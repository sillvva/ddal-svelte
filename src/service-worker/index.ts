import { version } from "$app/env";
import { assets, immutable } from "$app/manifest";
import { asset, resolve } from "$app/paths";
import { self } from "$app/service-worker";
import type { Path } from "$app/types";

const CACHE = `cache-${version}`;

const EXCLUDE = ["/auth"];

// Manifest paths are relative to the base path. `resolve` prefixes that base for build files;
// `asset` does the same for `static` files, including a configured assets host.
const ASSETS: string[] = [
	...immutable.map((entry) => resolve(entry.path as Path)),
	...assets.map((entry) => asset(entry.path))
];

self.addEventListener("install", (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

self.addEventListener("activate", (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") return;

	async function respond() {
		const url = new URL(event.request.url);

		if (EXCLUDE.some((path) => url.pathname.startsWith(path))) {
			return await fetch(event.request);
		}

		const cache = await caches.open(CACHE);

		if (ASSETS.includes(url.pathname)) {
			const result = await cache.match(url.pathname);
			return result || new Response(null, { status: 404 });
		}

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
