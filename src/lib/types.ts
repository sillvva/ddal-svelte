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
