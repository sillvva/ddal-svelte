import { browser } from "$app/environment";

import type { Cookies } from "@sveltejs/kit";

export async function setCookie(name: string, value: string | number | boolean | object | null) {
	if (!browser) return;
	const response = await fetch("/cookie", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({ name, value })
	});
	if (!response.ok) {
		throw new Error(`Failed to set cookie "${name}"`);
	}
}

export function serverSetCookie(cookies: Cookies, name: string, value: string) {
	if (browser) return null;
	const parts = name.split(":");
	if (parts[1]) {
		const [prefix, suffix] = parts;
		const existing = JSON.parse(cookies.get(prefix) || "{}") as Record<string, unknown>;
		existing[suffix] = value;
		cookies.set(prefix, JSON.stringify(existing), {
			httpOnly: true,
			path: "/",
			expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
		});
		return existing;
	} else {
		cookies.set(name, value, {
			httpOnly: true,
			path: "/",
			expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
		});
		return value;
	}
}
