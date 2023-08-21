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
