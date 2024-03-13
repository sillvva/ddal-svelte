import type { SearchData } from "$src/routes/(api)/command/+server";
import { writable } from "svelte/store";

export const pageLoader = writable(false);
export const searchData = writable<SearchData>([]);
