import { browser } from "$app/environment";

import type { Cookies } from "@sveltejs/kit";
import Cookie from "js-cookie";
import { writable, type Writable } from "svelte/store";

/**
 * Set a cookie from the browser using `js-cookie`.
 *
 * To update a specific property of an object stored in a cookie, the name of the cookie would be `cookieName:propertyName`.
 * For example, to update the `descriptions` property on the cookie `settings`, the name would be `settings:descriptions`.
 *
 * @param name Name of the cookie
 * @param value Value of the cookie
 * @param expires Expiration time of the cookie in milliseconds
 */
export function setCookie(name: string, value: string | number | boolean | object, expires = 1000 * 60 * 60 * 24 * 365) {
	if (!browser) return;
	if (typeof value === "undefined") throw new Error("Value is undefined");
	const parts = name.split(":");
	if (parts[1]) {
		const [prefix, suffix] = parts;
		if (prefix === undefined || suffix === undefined) throw new Error("Invalid cookie name");
		const val = Cookie.get(prefix) || "%7B%7D";
		const existing = JSON.parse(val.startsWith("%") ? decodeURIComponent(val) : val) as Record<string, unknown>;
		existing[suffix] = value;
		Cookie.set(prefix, JSON.stringify(existing), {
			path: "/",
			expires: new Date(Date.now() + expires)
		});
		return existing;
	} else {
		Cookie.set(name, typeof value !== "string" ? JSON.stringify(value) : value, {
			path: "/",
			expires: new Date(Date.now() + expires)
		});
		return value;
	}
}

export type CookieStore<T extends string | number | boolean | object> = Writable<T> & { initial: T };

/**
 * Create a cookie store that will automatically update the cookie whenever the store is updated.
 *
 * @param cookie The name of the cookie
 * @param initial The initial value of the cookie
 * @returns The cookie store
 */
export const cookieStore = function <T extends string | number | boolean | object>(name: string, initial: T) {
	const cookie = writable(initial);

	cookie.subscribe((value) => {
		setCookie(name, value);
	});

	return {
		...cookie,
		initial
	};
};

/**
 * Get a cookie from the server.
 *
 * The function should be called from the `load` function of a page/layout server route. The cookie will be returned as part
 * of the `load` function's return value.
 *
 * ```ts
 * const defaultValue = {
 * 	descriptions: false
 * };
 *
 * export const load = async (event) => {
 * 	const cookie = serverGetCookie(event.cookies, "settings", defaultValue);
 * 	return {
 * 		...cookie // {descriptions: boolean}
 * 	};
 * };
 * ```
 *
 * Then the cookie can be accessed an updated from the page/layout like so:
 *
 * ```ts
 * let descriptions = data.descriptions; // boolean
 * $: setCookie("settings:descriptions", descriptions);
 * ```
 *
 * The above example will *ONLY* set the `descriptions` property on the object stored in the `settings` cookie whenever the
 * `descriptions` variable changes and when the page/layout mounts.
 *
 * @param cookies Cookies object from the server
 * @param name Name of the cookie
 * @param defaultCookie Default value of the cookie
 * @returns The cookie value
 */
export function serverGetCookie<T extends string | number | boolean | object>(cookies: Cookies, name: string, defaultCookie: T) {
	const val = cookies.get(name) === "undefined" ? undefined : cookies.get(name);
	const cookie = val ? (JSON.parse(val) as T) : defaultCookie;
	if (typeof cookie !== typeof defaultCookie) throw new Error(`Cookie "${name}" is not of type ${typeof defaultCookie}`);
	if (typeof cookie === "object" && typeof defaultCookie === "object")
		return {
			...defaultCookie,
			...cookie
		};
	else return cookie;
}

/**
 * Set a http-only cookie from the server.
 *
 * This function should be called from a server action or server endpoint. The cookie will be set as http-only. It can then
 * be accessed from the `load` function of a page/layout server route using `serverGetCookie`.
 *
 * @param cookies Cookies object from the server
 * @param name Name of the cookie
 * @param value Value of the cookie
 * @param options Options for the cookie
 * @param options.expires Expiration time of the cookie in milliseconds
 * @param options.httpOnly Whether the cookie should be http-only. This prevents the cookie from being accessed from the browser.
 * @returns The cookie value
 */
export function serverSetCookie(
	cookies: Cookies,
	name: string,
	value: unknown,
	options?: {
		expires?: number;
		httpOnly?: boolean;
	}
) {
	const opts = {
		expires: 1000 * 60 * 60 * 24 * 365,
		httpOnly: false,
		...options
	};
	if (browser) return null;
	if (typeof value === "undefined") throw new Error("Value is undefined");
	const parts = name.split(":");
	if (parts[1]) {
		const [prefix, suffix] = parts;
		if (prefix === undefined || suffix === undefined) throw new Error("Invalid cookie name");
		const existing = JSON.parse(cookies.get(prefix) || "{}") as Record<string, unknown>;
		existing[suffix] = value;
		cookies.set(prefix, JSON.stringify(existing), {
			path: "/",
			expires: new Date(Date.now() + opts.expires),
			httpOnly: opts.httpOnly
		});
		return existing;
	} else {
		cookies.set(name, typeof value !== "string" ? JSON.stringify(value) : value, {
			path: "/",
			expires: new Date(Date.now() + opts.expires),
			httpOnly: opts.httpOnly
		});
		return value;
	}
}
