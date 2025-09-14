import { getRequestEvent } from "$app/server";
import { Duration, Effect } from "effect";
import * as v from "valibot";
import { AppLog } from "./effect/logging";

/**
 * Get a cookie from the server.
 *
 * @param cookies Cookies object from the server
 * @param name Name of the cookie
 * @param schema Default value of the cookie
 * @returns The cookie value
 */
export function serverGetCookie<TSchema extends v.GenericSchema>(name: string, schema: TSchema) {
	try {
		const event = getRequestEvent();

		const val = event.cookies.get(name);
		const cookie = val && val !== "undefined" ? JSON.parse(val) : serverSetCookie(name, schema, undefined);

		return v.parse(schema, cookie);
	} catch (error) {
		Effect.runFork(AppLog.error("Error getting cookie", { error }));
		return serverSetCookie(name, schema, undefined);
	}
}

/**
 * Set a http-only cookie from the server.
 *
 * @param cookies Cookies object from the server
 * @param name Name of the cookie
 * @param schema Schema of the cookie
 * @param value Value of the cookie
 * @param options.expires Expiration time of the cookie in milliseconds
 * @param options.httpOnly Whether the cookie should be http-only. This prevents the cookie from being accessed from the browser.
 * @returns The cookie value
 */
export function serverSetCookie<TSchema extends v.GenericSchema>(
	name: string,
	schema: TSchema,
	value: v.InferInput<TSchema>,
	{ expires = Duration.toMillis("365 days"), httpOnly = false } = {}
) {
	const event = getRequestEvent();

	const parsed = v.parse(schema, value);
	event.cookies.set(name, JSON.stringify(parsed), {
		path: "/",
		expires: new Date(Date.now() + expires),
		httpOnly
	});

	return parsed;
}
