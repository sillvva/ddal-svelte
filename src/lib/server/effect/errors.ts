import type { FullPathname } from "$lib/constants";
import { isInstanceOfClass } from "@sillvva/utils";
import { type NumericRange } from "@sveltejs/kit";
import { Cause, Data, Effect } from "effect";
import { setError, type FormPathLeavesWithErrors, type SuperValidated } from "sveltekit-superforms";

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
		message = "Unauthorized",
		status = 403,
		cause,
		redirectTo = "/"
	}: Partial<ErrorParams> & { redirectTo: FullPathname }) {
		super({ message, status, cause, redirectTo });
	}
}

export function redirectOnFail<R, F extends InstanceType<ErrorClass>, S>(
	effect: Effect.Effect<R, F, S>,
	redirectTo: FullPathname,
	status: NumericRange<300, 599>
) {
	return effect.pipe(Effect.catchAll((err) => new RedirectError({ message: err.message, redirectTo, status, cause: err })));
}

// -------------------------------------------------------------------------------------------------
// FormError
// -------------------------------------------------------------------------------------------------

export class FormError<SchemaOut extends Record<PropertyKey, unknown>> extends Data.TaggedError("FormError")<ErrorParams> {
	constructor(
		public message: string,
		protected options: Partial<{
			field: "" | FormPathLeavesWithErrors<SchemaOut>;
			status: NumericRange<300, 599>;
			cause: unknown;
		}> = {}
	) {
		super({ message, status: options.status || 500, cause: options.cause });
	}

	static from<SchemaOut extends Record<PropertyKey, unknown>>(
		err: unknown,
		field: "" | FormPathLeavesWithErrors<SchemaOut> = ""
	): FormError<SchemaOut> {
		if (isTaggedError(err)) return new FormError<SchemaOut>(err.message, { cause: err.cause, status: err.status, field });
		return new FormError<SchemaOut>(Cause.pretty(Cause.fail(err)), { cause: err, status: 500, field });
	}

	toForm(form: SuperValidated<SchemaOut>) {
		return setError(form, this.options?.field ?? "", this.message, {
			status: this.status < 400 ? 400 : (this.status as NumericRange<400, 599>)
		});
	}
}
