import type { FullPathname } from "$lib/constants";
import { isInstanceOfClass } from "@sillvva/utils";
import { type NumericRange } from "@sveltejs/kit";
import { Data, Effect } from "effect";

export interface ErrorParams {
	message: string;
	status: NumericRange<300, 599>;
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
		"message" in error &&
		typeof error.message === "string" &&
		"_tag" in error &&
		typeof error._tag === "string"
	);
}

export class FailedError extends Data.TaggedError("FailedError")<ErrorParams> {
	constructor(action: string, cause?: unknown) {
		super({ message: `Failed to ${action}`, status: 500, cause });
	}
}

// -------------------------------------------------------------------------------------------------
// RedirectError
// -------------------------------------------------------------------------------------------------

interface RedirectErrorParams extends ErrorParams {
	redirectTo: FullPathname;
	status: NumericRange<301, 308>;
}

/**
 * A redirect error is an error that is thrown when a redirect is needed.
 *
 * - 301 - Moved Permanently, always GET
 * - 302 - Moved Temporarily, always GET
 * - 303 - See Other, POST -> GET, after successful form submission
 * - 307 - Temporary Redirect, preserves method
 * - 308 - Permanent Redirect, preserves method
 */
export class RedirectError extends Data.TaggedError("RedirectError")<RedirectErrorParams> {
	constructor({
		message,
		redirectTo,
		status = 302,
		cause
	}: { message: string; redirectTo: FullPathname } & Partial<RedirectErrorParams>) {
		super({ message, redirectTo, status, cause });
	}
}

export function redirectOnFail<R, F extends InstanceType<ErrorClass>, S>(
	effect: Effect.Effect<R, F, S>,
	redirectTo: FullPathname,
	status: NumericRange<301, 308>
) {
	return effect.pipe(Effect.catchAll((err) => new RedirectError({ message: err.message, redirectTo, status, cause: err })));
}
