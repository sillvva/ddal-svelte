import { error } from "@sveltejs/kit";

export type DatesToStrings<T> = {
	[K in keyof T]: T[K] extends Date
		? string
		: T[K] extends Date | null
		? string | null
		: T[K] extends Date | undefined
		? string | undefined
		: T[K] extends Date | null | undefined
		? string | null | undefined
		: T[K] extends object
		? DatesToStrings<T[K]>
		: T[K];
};

export function handleSKitError(err: unknown) {
	if (
		err &&
		typeof err == "object" &&
		"status" in err &&
		typeof err.status == "number" &&
		"body" in err &&
		typeof err.body == "string"
	)
		throw error(err.status, err.body);
}

export type LimitDepth<T, TLength = 5, TDepth extends unknown[] = []> = TDepth["length"] extends TLength
	? never
	: T extends object
	? {
			[K in keyof T]: LimitDepth<T[K], TLength, [unknown, ...TDepth]>;
	  }
	: T extends Array<infer U>
	? Array<LimitDepth<U, TLength, [unknown, ...TDepth]>>
	: T;

export type DeepStringify<T> = {
	[K in keyof T]: T[K] extends Array<infer E>
		? DeepStringify<Array<E>>
		: T[K] extends Date | Blob | File
		? string
		: T[K] extends object
		? DeepStringify<T[K]>
		: string;
};

type Idx<T, K> = K extends keyof T ? T[K] : number extends keyof T ? (K extends `${number}` ? T[number] : never) : never;

type Join<K, P> = K extends string | number ? (P extends string | number ? `${K}${"" extends P ? "" : "."}${P}` : never) : never;

type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, ...0[]];

export type Paths<T, D extends number = 10> = [D] extends [never]
	? never
	: T extends object
	? {
			[K in keyof T]-?: K extends string | number
				? DeepStringify<T>[K] extends string
					? `${K}` | Join<K, Paths<T[K], Prev[D]>>
					: Join<K, Paths<T[K], Prev[D]>>
				: never;
	  }[keyof T]
	: "";

export type PathValue<T, P extends Paths<T, 5>, TLength = 5> = P extends `${infer Key}.${infer Rest}`
	? Rest extends Paths<Idx<LimitDepth<T, TLength>, Key>, 5>
		? PathValue<Idx<LimitDepth<T, TLength>, Key>, Rest>
		: never
	: Idx<LimitDepth<T, TLength>, P>;

/**
 * `SvelteMap` class, a subclass of JavaScript's `Map` class
 * with modified methods for remove and clear operations that return the `Map` itself for chain invocations.
 */
export class SvelteMap<TKey, TVal> extends Map<TKey, TVal> {
	constructor(iterable?: Iterable<readonly [TKey, TVal]> | null) {
		super(iterable);
	}

	/**
	 * `remove` method for `SvelteMap`, deletes an element with the specified key from the Map.
	 * @param key - Key of the element to remove from the Map.
	 * @returns `this` - Returns the `Map` itself after removal for chain invocations.
	 */
	public remove(key: TKey) {
		super.delete(key);
		return this;
	}

	/**
	 * `clear` method for `SvelteMap`, removes all elements from the Map.
	 * @returns `this` - Returns the `Map` itself after the operation for chain invocations.
	 */
	public clear() {
		super.clear();
		return this;
	}
}
