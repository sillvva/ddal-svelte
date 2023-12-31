import { writable } from "svelte/store";

// Show/Hide the full page loader with backdrop
export const pageLoader = writable(false);

// Show/Hide a modal
export const modal = writable<{ name: string; description: string; date?: Date } | null>(null);
