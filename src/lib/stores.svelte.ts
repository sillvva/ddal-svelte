import { browser } from "$app/environment";
import type { SearchData } from "$src/routes/(api)/command/+server";
import { createContext } from "svelte-contextify";
import { setupViewTransition } from "sveltekit-view-transition";

export const appDefaults: App.Cookie = {
	settings: {
		theme: "system",
		mode: "dark",
		autoWebAuthn: false
	},
	characters: {
		magicItems: false,
		display: "list"
	},
	log: {
		descriptions: false
	},
	dmLogs: {
		sort: "asc"
	}
};

export const global = $state<{
	pageLoader: boolean;
	searchData: SearchData;
	app: App.Cookie;
}>({
	pageLoader: false,
	searchData: [],
	app: appDefaults
});

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
