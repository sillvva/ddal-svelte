import { dev } from "$app/environment";
import type { AuthClient } from "$server/db/schema";
import { type NumericRange } from "@sveltejs/kit";
import { message, setError, type FormPathLeavesWithErrors, type SuperValidated } from "sveltekit-superforms";
import type { setupViewTransition } from "sveltekit-view-transition";

/**
 * Types
 */

export type Prettify<T> = {
	[K in keyof T]: T[K];
} & unknown;

export type TransitionAction = ReturnType<typeof setupViewTransition>["transition"];

export type Falsy = false | 0 | "" | null | undefined;

export type DictOrArray = Record<PropertyKey, unknown> | Array<unknown>;

/**
 * Functions
 */

export async function createTransition(action: ViewTransitionCallback, after?: () => void | Promise<void>, afterDelay = 0) {
	if (!document.startViewTransition) action();
	else document.startViewTransition(action);
	if (after) wait(afterDelay).then(after);
}

export function isDefined<T>(value?: T | null): value is T {
	return value !== undefined && value !== null;
}

export function authName(authenticator: AuthClient) {
	return authenticator.name || authenticator.credentialID.replace(/[^a-z0-9]/gi, "").slice(-8);
}

export function wait(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Classes
 */

export type SaveResult<T extends DictOrArray | null, S extends SaveError<any>> = Promise<T | S>;

export class SaveError<TOut extends Record<string, unknown>, TIn extends Record<string, unknown> = TOut> {
	public status: NumericRange<400, 599> = 500;

	constructor(
		public error: string,
		protected options?: Partial<{
			field: "" | FormPathLeavesWithErrors<TOut>;
			status: NumericRange<400, 599>;
		}>
	) {
		if (options?.status) this.status = options.status;
	}

	/**
	 * Creates a `SaveError` instance from the provided error object or message.
	 * - If the error object is already an instance of `SaveError`, it is returned as is.
	 * - If the error is a string, a new `SaveError` instance is created with the string as the error message.
	 * - If the error is an object with a `message` property of type string, a new `SaveError` instance is created with the `message` as the error message.
	 * - If none of the above conditions are met, a new `SaveError` instance with a default error message is created.
	 *
	 * @typeparam TOut - The type of the output data.
	 * @typeparam TIn - The type of the input data.
	 * @param err - The error object or message.
	 * @returns A `SaveError` instance.
	 */
	static from<TOut extends Record<string, unknown>, TIn extends Record<string, unknown> = TOut>(
		err: SaveError<TOut, TIn> | Error | unknown
	) {
		if (dev) console.error(err);
		if (!err) return new SaveError<TOut, TIn>("Undefined error");
		if (err instanceof SaveError) return err;
		if (typeof err === "string") return new SaveError<TOut, TIn>(err);
		if (typeof err === "object" && "message" in err && typeof err.message === "string") {
			return new SaveError<TOut, TIn>(err.message);
		}
		return new SaveError<TOut, TIn>("Unknown error");
	}

	/**
	 * Adds the error message to the form.
	 * @param form - The validated form to convert.
	 * @returns The form with error messages.
	 */
	toForm(form: SuperValidated<TOut, App.Superforms.Message, TIn>) {
		return isDefined(this.options?.field)
			? setError(form, this.options.field, this.error, {
					status: this.status
				})
			: message(
					form,
					{
						type: "error",
						text: this.error
					},
					{
						status: this.status
					}
				);
	}
}

export function parseError(e: unknown) {
	if (!e) return "Undefined error";
	if (e instanceof Error) return e.message;
	if (typeof e === "string") return e;
	if (typeof e === "object") return JSON.stringify(e);
	return "Unknown error";
}
