import { writable } from "svelte/store";

// Show/Hide the full page loader with backdrop
export const pageLoader = writable(false);

export const modal = writable<{ name: string; description: string; date?: Date } | null>(null);

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

/**
 * `SvelteSet` class, a subclass of JavaScript's `Set` class
 * with modified methods for remove and clear operations that return the `Set` itself for chain invocations.
 */
export class SvelteSet<TVal> extends Set<TVal> {
	constructor(iterable?: Iterable<TVal> | null) {
		super(iterable);
	}

	/**
	 * `remove` method for `SvelteSet`, deletes a value from the Set.
	 * @param val - Value to remove from the Set.
	 * @returns `this` - Returns the `Set` itself after removal for chain invocations.
	 */
	public remove(val: TVal) {
		super.delete(val);
		return this;
	}

	/**
	 * `clear` method for `SvelteSet`, removes all elements from the Set.
	 * @returns `this` - Returns the `Set` itself after the operation for chain invocations.
	 */
	public clear() {
		super.clear();
		return this;
	}
}
