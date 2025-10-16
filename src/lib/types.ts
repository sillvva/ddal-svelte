export type Awaitable<T> = T | PromiseLike<T>;

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
