import { browser } from "$app/environment";
import { Duration } from "effect";
import Cookie from "js-cookie";
import { untrack } from "svelte";
import { SvelteDate } from "svelte/reactivity";
import * as v from "valibot";
import { createContext } from "./factories.svelte";
import * as API from "./remote";
import { logClientError } from "./remote/admin/actions.remote";
import { appCookieSchema, type AppCookie } from "./schemas";

/**
 * Set a cookie from the browser using `js-cookie`.
 *
 * @param name Name of the cookie
 * @param value Value of the cookie
 * @param expires Expiration time of the cookie in milliseconds
 */
export function setCookie<TSchema extends v.GenericSchema>(
	name: string,
	schema: TSchema,
	value: v.InferInput<TSchema>,
	expires = Duration.toMillis("365 days")
) {
	if (!browser) return value;
	if (typeof value === "undefined") throw new Error("Value is undefined");

	const parsed = v.parse(schema, value);
	Cookie.set(name, typeof parsed !== "string" ? JSON.stringify(parsed) : parsed, {
		path: "/",
		expires: new SvelteDate(Date.now() + expires)
	});

	return value;
}

export class Global {
	private _pageLoader: boolean = $state.raw(false);

	get pageLoader() {
		return this._pageLoader;
	}
	set pageLoader(value: boolean) {
		this._pageLoader = value;
	}
}

export const [getGlobal] = createContext(() => new Global());

export async function getAuth() {
	const result = await API.app.queries.request();
	return {
		user: result.user,
		session: result.session,
		refresh: () => API.app.queries.request().refresh()
	};
}

export async function getApp() {
	const result = await API.app.queries.request();
	return result.app;
}

export async function setApp(fn: (app: AppCookie) => void) {
	return await untrack(async () => {
		const app = await getApp();
		fn(app);
		setCookie("app", appCookieSchema, app);
		await API.app.queries.request().refresh();
		return app;
	});
}

class Logger {
	private _lastLog: { label: string; timestamp: number } = $state.raw({ label: "", timestamp: 0 });

	private hasKey<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
		return obj !== null && typeof obj === "object" && key in obj;
	}

	log(error: unknown, boundary?: string) {
		const now = Date.now();

		const message =
			typeof error === "string"
				? error
				: this.hasKey(error, "message") && typeof error.message === "string"
					? error.message
					: "Something went wrong";

		const err = {
			message: message,
			name: this.hasKey(error, "name") && typeof error.name === "string" ? error.name : undefined,
			stack: this.hasKey(error, "stack") && typeof error.stack === "string" ? error.stack : undefined,
			cause: this.hasKey(error, "cause") ? error.cause : undefined,
			boundary
		};

		if (!browser) return err;
		// Prevent logging the same error within 5 seconds
		if (now - this._lastLog.timestamp < 5000 && message === this._lastLog.label) {
			this._lastLog = { label: message, timestamp: now };
			return err;
		}

		console.error(error);
		if (message !== "Something went wrong") {
			logClientError(err);
		}

		return err;
	}
}

export const [getLogger] = createContext(() => new Logger());
