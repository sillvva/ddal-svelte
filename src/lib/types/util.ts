import type { BaseSchema, BaseSchemaAsync, Input } from "valibot";

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

export type DeepStringify<T> = {
	[K in keyof T]: T[K] extends object ? DeepStringify<T[K]> : string;
};

export function deepStringify<S extends BaseSchema | BaseSchemaAsync, T extends Input<S>>(data: T): DeepStringify<T> {
	const result = Array.isArray(data) ? ([] as T) : ({} as T);
	for (const key in data) {
		if (Array.isArray(data[key])) {
			result[key] = deepStringify(data[key]);
		} else if (data[key] && typeof data[key] === "object" && !((data[key] as object) instanceof Date)) {
			result[key] = deepStringify(data[key]);
		} else {
			result[key] = "";
		}
	}
	return result;
}

export function setNestedError<T>(err: T, keysArray: string[], value: string) {
	let current: any = err;
	for (let i = 0; i < keysArray.length - 1; i++) {
		const key = keysArray[i];
		if (!(current[key] instanceof Object)) {
			current[key] = {};
		}
		current = current[key];
	}
	current[keysArray[keysArray.length - 1]] = value;
}
