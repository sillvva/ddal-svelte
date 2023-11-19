import { writable, type Writable } from "svelte/store";

// Show/Hide the full page loader with backdrop
export const pageLoader = writable(false);

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
};
export type AppStore = Writable<App>;
