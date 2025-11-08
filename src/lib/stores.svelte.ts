import { browser } from "$app/environment";
import { Duration } from "effect";
import Cookie from "js-cookie";
import { SvelteDate } from "svelte/reactivity";
import * as v from "valibot";
import * as API from "./remote";
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
	const request = API.app.queries.request();
	const result = await request;
	return {
		user: result.user,
		session: result.session,
		refresh: () => request.refresh()
	};
}
