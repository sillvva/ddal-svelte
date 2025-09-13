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
	getPageTitle?: (data: unknown) => string;
	pageHead?: PageHead;
	getPageHead?: (data: unknown) => Partial<PageHead>;
};

export const routeModules: Record<string, ModuleData> = import.meta.glob("/src/routes/**/+page.svelte", {
	eager: true
});
