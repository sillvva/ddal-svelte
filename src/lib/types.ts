export type Awaitable<T> = T | PromiseLike<T>;

export type DeepReadonly<T> = T extends Record<PropertyKey, unknown> | unknown[]
	? {
			readonly [K in keyof T]: T[K] extends Record<PropertyKey, unknown> | unknown[] ? DeepReadonly<T[K]> : T[K];
		}
	: T;

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
	pageHead?: PageHead;
	getPageHead?: (params: unknown) => Awaitable<Partial<PageHead>>;
};
