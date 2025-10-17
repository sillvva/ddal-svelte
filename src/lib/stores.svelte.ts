import { browser } from "$app/environment";
import { Duration } from "effect";
import Cookie from "js-cookie";
import { getContext, setContext } from "svelte";
import { SvelteDate } from "svelte/reactivity";
import * as v from "valibot";
import * as API from "./remote";
import { appCookieSchema, appDefaults, type AppCookie, type LocalsSession, type LocalsUser } from "./schemas";

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
	private _user: LocalsUser | undefined = $state.raw();
	private _session: LocalsSession | undefined = $state.raw();
	private _pageLoader: boolean = $state.raw(false);

	constructor(app: AppCookie) {
		this._app = app;

		$effect(() => {
			setCookie("app", appCookieSchema, this._app);
		});
	}

	get app() {
		return this._app;
	}
	set app(value: AppCookie) {
		this._app = value;
	}

	get user() {
		return this._user;
	}
	set user(value: LocalsUser | undefined) {
		this._user = value;
	}

	get session() {
		return this._session;
	}
	set session(value: LocalsSession | undefined) {
		this._session = value;
	}

	async refresh() {
		const request = API.app.queries.request();
		await request.refresh();
		this._user = request.current?.user;
		this._session = request.current?.session;
	}

	get pageLoader() {
		return this._pageLoader;
	}
	set pageLoader(value: boolean) {
		this._pageLoader = value;
	}
}

const globalKey = Symbol("global");
export function getGlobal() {
	return getContext<Global>(globalKey);
}
export function createGlobal(app: AppCookie) {
	return setContext(globalKey, new Global(app));
}
