import { getRequestEvent } from "$app/server";
import * as v from "valibot";

/**
 * Get a cookie from the server.
 *
 * @param cookies Cookies object from the server
 * @param name Name of the cookie
 * @param schema Default value of the cookie
 * @returns The cookie value
 */
export function serverGetCookie<TSchema extends v.BaseSchema<any, any, any>>(name: string, schema: TSchema) {
	try {
		const event = getRequestEvent();
		if (!event) throw new Error("No event");

		const val = event.cookies.get(name);
		const cookie = val && val !== "undefined" ? JSON.parse(val) : serverSetCookie(name, schema, undefined);

		return v.parse(schema, cookie);
	} catch (err) {
		console.error(err);
		return serverSetCookie(name, schema, undefined);
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

	const event = getRequestEvent();
	if (!event) throw new Error("No event");

	const parsed = v.parse(schema, value);
	event.cookies.set(name, JSON.stringify(parsed), {
		path: "/",
		expires: new Date(Date.now() + opts.expires),
		httpOnly: opts.httpOnly
	});

	return parsed;
}
