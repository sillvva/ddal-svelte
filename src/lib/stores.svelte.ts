import { browser } from "$app/environment";
import type { SearchData } from "$src/routes/(api)/command/+server";
import { createContext } from "svelte-contextify";
import { setupViewTransition } from "sveltekit-view-transition";
import { appDefaults } from "./constants";

export const global = $state({
	pageLoader: false,
	searchData: [] as SearchData,
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
