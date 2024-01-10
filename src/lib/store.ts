import { writable } from "svelte/store";

// Show/Hide the full page loader with backdrop
export const pageLoader = writable(false);
