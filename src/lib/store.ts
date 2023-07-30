import { writable } from "svelte/store";

// Show/Hide the full page loader with backdrop
export const pageLoader = writable(false);

export const modal = writable<{ name: string; description: string; date?: Date } | null>(null);

export class SvelteMap<TKey, TVal> extends Map<TKey, TVal> {
	constructor(iterable?: Iterable<readonly [TKey, TVal]> | null) {
		super(iterable);
	}

	public remove(key: TKey) {
		super.delete(key);
		return this;
	}

	public clear() {
		super.clear();
		return this;
	}
}

export class SvelteSet<TVal> extends Set<TVal> {
	constructor(iterable?: Iterable<TVal> | null) {
		super(iterable);
	}

	public remove(val: TVal) {
		super.delete(val);
		return this;
	}

	public clear() {
		super.clear();
		return this;
	}
}
