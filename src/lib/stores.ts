import type { SearchData } from "$src/routes/(api)/command/+server";
import { createContext } from "svelte-contextify";
import { writable } from "svelte/store";

export const pageLoader = writable(false);
export const searchData = writable<SearchData>([]);

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

export const { get: getApp, set: setApp } = createContext({
	defaultValue: writable(appDefaults)
});
