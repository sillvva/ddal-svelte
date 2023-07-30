import { writable } from "svelte/store";

// Show/Hide the full page loader with backdrop
export const pageLoader = writable(false);

export const modal = writable<{ name: string; description: string; date?: Date } | null>(null);

export class SvelteMap<TKey, TVal> {
	private map: Map<TKey, TVal>;

	constructor(iterable?: Iterable<readonly [TKey, TVal]> | null) {
		this.map = new Map<TKey, TVal>(iterable);
	}

	[Symbol.iterator]() {
		return this.map.entries();
	}

	public has(key: TKey) {
		return this.map.has(key);
	}

	public get(key: TKey) {
		return this.map.get(key);
	}

	public set(key: TKey, val: TVal) {
		this.map.set(key, val);
		return this;
	}

	public delete(key: TKey) {
		this.map.delete(key);
		return this;
	}

	public clear() {
		this.map.clear();
		return this;
	}

	public forEach(callbackfn: (value: TVal, key: TKey, map: Map<TKey, TVal>) => void, thisArg?: unknown) {
		this.map.forEach(callbackfn, thisArg);
	}

	get size(): number {
		return this.map.size;
	}
}

export class SvelteSet<TVal> {
	private set: Set<TVal>;

	constructor(iterable?: Iterable<TVal> | null) {
		this.set = new Set<TVal>(iterable);
	}

	[Symbol.iterator]() {
		return this.set.values();
	}

	public has(val: TVal) {
		return this.set.has(val);
	}

	public add(val: TVal) {
		this.set.add(val);
		return this;
	}

	public delete(val: TVal) {
		this.set.delete(val);
		return this;
	}

	public clear() {
		this.set.clear();
		return this;
	}

	get size() {
		return this.set.size;
	}

	public forEach(callbackfn: (value: TVal, value2: TVal, set: Set<TVal>) => void, thisArg?: unknown) {
		this.set.forEach(callbackfn, thisArg);
	}
}
