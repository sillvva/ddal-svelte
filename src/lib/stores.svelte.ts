import { browser } from "$app/environment";
import { setCookie } from "$server/cookie";
import type { SearchData } from "$src/routes/(api)/command/+server";
import { getContext, setContext } from "svelte";
import { createContext } from "svelte-contextify";
import { fromAction } from "svelte/attachments";
import { setupViewTransition } from "sveltekit-view-transition";
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

class Global {
	_app: AppCookie = $state(appDefaults);
	_pageLoader: boolean = $state(false);
	_searchData: SearchData = $state([]);

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

	get searchData() {
		return this._searchData;
	}
	set searchData(value: SearchData) {
		this._searchData = value;
	}
}

const globalKey = Symbol();
export function getGlobal() {
	return getContext<Global>(globalKey);
}
export function createGlobal(app: AppCookie) {
	const global = new Global(app);
	return setContext(globalKey, global);
}
