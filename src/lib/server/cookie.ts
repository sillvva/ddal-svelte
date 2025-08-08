import { getRequestEvent } from "$app/server";
import type { AnyBaseSchema } from "$lib/schemas";
import { Duration, Effect } from "effect";
import * as v from "valibot";
import { AppLog } from "./effect";

/**
 * Get a cookie from the server.
 *
 * @param cookies Cookies object from the server
 * @param name Name of the cookie
 * @param schema Default value of the cookie
 * @returns The cookie value
 */
export function serverGetCookie<TSchema extends AnyBaseSchema>(name: string, schema: TSchema) {
	try {
		const event = getRequestEvent();
		if (!event) throw new Error("No event");

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
 * @param value Value of the cookie
 * @param options Options for the cookie
 * @param options.expires Expiration time of the cookie in milliseconds
 * @param options.httpOnly Whether the cookie should be http-only. This prevents the cookie from being accessed from the browser.
 * @returns The cookie value
 */
export function serverSetCookie<TSchema extends AnyBaseSchema>(
	name: string,
	schema: TSchema,
	value: v.InferInput<TSchema>,
	options?: {
		expires?: number;
		httpOnly?: boolean;
	}
) {
	const opts = {
		expires: Duration.toMillis("365 days"),
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
