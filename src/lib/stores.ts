import type { SearchData } from "$src/routes/(api)/command/+server";
import { createContext } from "svelte-contextify";
import { writable } from "svelte/store";

export const pageLoader = writable(false);
export const searchData = writable<SearchData>([]);

const appDefaults: App.Cookie = {
	settings: {
		theme: "system",
		mode: "dark",
		autoWebAuthn: false,
		authenticators: 0
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

const { get: getApp, set: setApp } = createContext({
	defaultValue: writable(appDefaults)
});

export { appDefaults, getApp, setApp };
