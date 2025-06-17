import { browser } from "$app/environment";
import type { Cookies } from "@sveltejs/kit";
import Cookie from "js-cookie";

/**
 * Set a cookie from the browser using `js-cookie`.
 *
 * @param name Name of the cookie
 * @param value Value of the cookie
 * @param expires Expiration time of the cookie in milliseconds
 */
export function setCookie<T extends string | number | boolean | object>(
	name: string,
	value: T,
	expires = 1000 * 60 * 60 * 24 * 365
) {
	if (!browser) return value;
	if (typeof value === "undefined") throw new Error("Value is undefined");
	Cookie.set(name, typeof value !== "string" ? JSON.stringify(value) : value, {
		path: "/",
		expires: new Date(Date.now() + expires)
	});
	return value;
}

/**
 * Get a cookie from the server.
 *
 * @param cookies Cookies object from the server
 * @param name Name of the cookie
 * @param defaultCookie Default value of the cookie
 * @returns The cookie value
 */
export function serverGetCookie<T extends string | number | boolean | object>(cookies: Cookies, name: string, defaultCookie: T) {
	const val = cookies.get(name) === "undefined" ? undefined : cookies.get(name);
	const cookie = val ? (JSON.parse(val) as T) : serverSetCookie(cookies, name, defaultCookie);
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
 * @param cookies Cookies object from the server
 * @param name Name of the cookie
 * @param value Value of the cookie
 * @param options Options for the cookie
 * @param options.expires Expiration time of the cookie in milliseconds
 * @param options.httpOnly Whether the cookie should be http-only. This prevents the cookie from being accessed from the browser.
 * @returns The cookie value
 */
export function serverSetCookie<T extends string | number | boolean | object>(
	cookies: Cookies,
	name: string,
	value: T,
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
	if (typeof value === "undefined") throw new Error("Value is undefined");
	cookies.set(name, typeof value !== "string" ? JSON.stringify(value) : value, {
		path: "/",
		expires: new Date(Date.now() + opts.expires),
		httpOnly: opts.httpOnly
	});
	return value;
}
