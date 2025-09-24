import type { Awaitable } from "./util";

export type Crumb = {
	title: string;
	url: string;
};
export type PageHead = {
	title: string;
	description?: string;
	image?: string;
};
export type ModuleData = {
	pageTitle?: string;
	getPageTitle?: (params: unknown) => Awaitable<string>;
	pageHead?: PageHead;
	getPageHead?: (params: unknown) => Awaitable<Partial<PageHead>>;
};

export const routeModules: Record<string, ModuleData> = import.meta.glob("/src/routes/**/+page.svelte", {
	eager: true
});
