import { isInstanceOfClass } from "@sillvva/utils";
import { type NumericRange } from "@sveltejs/kit";
import { Data } from "effect";

interface ErrorParams {
	message: string;
	status: NumericRange<400, 599>;
	cause?: unknown;
	[key: string]: unknown;
}

export interface ErrorClass {
	new (...args: unknown[]): { _tag: string } & ErrorParams;
}

export function ErrorFactory<T extends string>(tag: T) {
	return class extends Data.TaggedError(tag)<ErrorParams> {
		constructor(params: ErrorParams) {
			super(params);
		}
	};
}

export function isTaggedError(error: unknown): error is InstanceType<ErrorClass> {
	return (
		isInstanceOfClass(error) &&
		"status" in error &&
		typeof error.status === "number" &&
		error.status >= 400 &&
		error.status <= 599 &&
		"cause" in error &&
		"message" in error &&
		typeof error.message === "string" &&
		"_tag" in error &&
		typeof error._tag === "string"
	);
}
