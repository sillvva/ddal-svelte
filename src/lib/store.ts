import { cookieStore } from "$src/server/cookie";
import { writable } from "svelte/store";

// Show/Hide the full page loader with backdrop
export const pageLoader = writable(false);

export const modal = writable<{ name: string; description: string; date?: Date } | null>(null);

export const defaultSettingsCookie = {
	showBackground: true,
	theme: "system",
	mode: "dark"
};

export const showBg = cookieStore<typeof defaultSettingsCookie.showBackground>("settings:showBackground", true);
