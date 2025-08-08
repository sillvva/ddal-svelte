import { browser } from "$app/environment";
import { Duration } from "effect";
import Cookie from "js-cookie";
import { getContext, setContext } from "svelte";
import { createContext } from "svelte-contextify";
import { fromAction } from "svelte/attachments";
import { SvelteDate } from "svelte/reactivity";
import { setupViewTransition } from "sveltekit-view-transition";
import * as v from "valibot";
import { appCookieSchema, appDefaults, type AppCookie } from "./schemas";

export const { get: transitionGetter, set: transitionSetter } = createContext({
	defaultValue: () => {
		const { transition } = setupViewTransition();
		return transition;
	}
});
export const setTransition = () => {
	const { transition } = setupViewTransition();
	if (browser) transitionSetter(() => transition);
};
export const transition = (key: string) => fromAction(transitionGetter()(), () => key);

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

class Global {
	_app: AppCookie = $state(appDefaults);
	_pageLoader: boolean = $state(false);

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
	const global = new Global(app);
	return setContext(globalKey, global);
}
