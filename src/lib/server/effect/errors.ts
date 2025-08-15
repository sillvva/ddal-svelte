import { isInstanceOfClass } from "@sillvva/utils";
import { type NumericRange } from "@sveltejs/kit";
import { Cause, Data } from "effect";
import { setError, type FormPathLeavesWithErrors, type SuperValidated } from "sveltekit-superforms";

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

// -------------------------------------------------------------------------------------------------
// FormError
// -------------------------------------------------------------------------------------------------

export class FormError<SchemaOut extends Record<PropertyKey, unknown>> extends Data.TaggedError("FormError")<ErrorParams> {
	constructor(
		public message: string,
		protected options: Partial<{
			field: "" | FormPathLeavesWithErrors<SchemaOut>;
			status: NumericRange<400, 599>;
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
			status: this.status
		});
	}
}
