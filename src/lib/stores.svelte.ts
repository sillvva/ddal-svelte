import { browser } from "$app/environment";
import type { SearchData } from "$src/routes/(api)/command/+server";
import { getContext, setContext } from "svelte";
import { createContext } from "svelte-contextify";
import { setupViewTransition } from "sveltekit-view-transition";
import { appDefaults } from "./constants";

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
export const getTransition = () => transitionGetter()();

class Global {
	_app: App.Cookie = $state(appDefaults);
	_pageLoader: boolean = $state(false);
	_searchData: SearchData = $state([]);

	constructor(app: App.Cookie) {
		this._app = app;
	}

	get app() {
		return this._app;
	}
	set app(value: App.Cookie) {
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
export function createGlobal(app: App.Cookie) {
	const global = new Global(app);
	return setContext(globalKey, global);
}
