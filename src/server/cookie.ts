import { browser } from "$app/environment";
import type { Cookies } from "@sveltejs/kit";
import Cookie from "js-cookie";
import * as v from "valibot";

/**
 * Set a cookie from the browser using `js-cookie`.
 *
 * @param name Name of the cookie
 * @param value Value of the cookie
 * @param expires Expiration time of the cookie in milliseconds
 */
export function setCookie<TSchema extends v.BaseSchema<any, any, any>>(
	name: string,
	schema: TSchema,
	value: v.InferInput<TSchema>,
	expires = 1000 * 60 * 60 * 24 * 365
) {
	if (!browser) return value;
	if (typeof value === "undefined") throw new Error("Value is undefined");
	const parsed = v.parse(schema, value);
	Cookie.set(name, typeof parsed !== "string" ? JSON.stringify(parsed) : parsed, {
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
 * @param schema Default value of the cookie
 * @returns The cookie value
 */
export function serverGetCookie<TSchema extends v.BaseSchema<any, any, any>>(cookies: Cookies, name: string, schema: TSchema) {
	try {
		const val = cookies.get(name) === "undefined" ? undefined : cookies.get(name);
		const cookie = val ? JSON.parse(val) : serverSetCookie(cookies, name, schema, undefined);
		return v.parse(schema, cookie);
	} catch (err) {
		console.error(err);
		return serverSetCookie(cookies, name, schema, undefined);
	}
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
export function serverSetCookie<TSchema extends v.BaseSchema<any, any, any>>(
	cookies: Cookies,
	name: string,
	schema: TSchema,
	value: v.InferInput<TSchema>,
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
	const parsed = v.parse(schema, value);
	cookies.set(name, JSON.stringify(parsed), {
		path: "/",
		expires: new Date(Date.now() + opts.expires),
		httpOnly: opts.httpOnly
	});
	return parsed;
}
