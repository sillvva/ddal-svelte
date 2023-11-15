import { cookieStore } from "$src/server/cookie";
import { writable } from "svelte/store";

// Show/Hide the full page loader with backdrop
export const pageLoader = writable(false);

export const modal = writable<{ name: string; description: string; date?: Date } | null>(null);

export const app = cookieStore<{
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
}>("app", {
	settings: {
		background: true,
		theme: "system",
		mode: "dark"
	},
	character: {
		descriptions: false
	},
	characters: {
		magicItems: false,
		display: "list"
	}
});
