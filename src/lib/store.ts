import type { CookieStore } from "$src/server/cookie";
import { writable } from "svelte/store";

// Show/Hide the full page loader with backdrop
export const pageLoader = writable(false);

// Show/Hide a modal
export const modal = writable<{ name: string; description: string; date?: Date } | null>(null);

export type App = {
	settings: {
		background: boolean;
		theme: "system" | "dark" | "light";
		mode: "dark" | "light";
	};
	character: {
		descriptions: boolean;
	};
	characters: {
		magicItems: boolean;
		display: "list" | "grid";
	};
	dmLogs: {
		sort: "asc" | "desc";
	};
};
export type AppStore = CookieStore<App>;
