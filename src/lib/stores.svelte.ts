import { browser } from "$app/environment";
import { Duration } from "effect";
import Cookie from "js-cookie";
import { SvelteDate } from "svelte/reactivity";
import * as v from "valibot";
import * as API from "./remote";
import { logClientError } from "./remote/admin/actions.remote";
import { appCookieSchema, appDefaults, type AppCookie } from "./schemas";
import { createContext } from "./util";

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
	private _app: AppCookie = $state(appDefaults);
	private _pageLoader: boolean = $state.raw(false);

	constructor(app: AppCookie = appDefaults) {
		this._app = app;
	}

	get app(): DeepReadonly<AppCookie> {
		return $state.snapshot(this._app);
	}
	set app(value: AppCookie) {
		this._app = value;
	}
	public setApp(fn: (app: AppCookie) => void) {
		fn(this._app);
		setCookie("app", appCookieSchema, $state.snapshot(this._app));
	}

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
