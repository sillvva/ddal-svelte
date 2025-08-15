import { isInstanceOfClass } from "@sillvva/utils";
import { type NumericRange } from "@sveltejs/kit";

export interface ErrorParams {
	message: string;
	status: NumericRange<400, 599>;
	cause?: unknown;
	[key: string]: unknown;
}

export interface ErrorClass {
	new (...args: unknown[]): { _tag: string } & ErrorParams;
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
