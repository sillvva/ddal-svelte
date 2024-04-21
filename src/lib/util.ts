import { dev } from "$app/environment";
import { type NumericRange } from "@sveltejs/kit";
import {
	message,
	setError,
	type FormPathLeaves,
	type FormPathLeavesWithErrors,
	type FormPathType,
	type SuperValidated
} from "sveltekit-superforms";
import type { setupViewTransition } from "sveltekit-view-transition";
import type { BrandedType } from "./schemas";

/**
 * Types
 */

export type Prettify<T> = {
	[K in keyof T]: T[K];
} & unknown;

export type TransitionAction = ReturnType<typeof setupViewTransition>["transition"];

export type Falsy = false | 0 | "" | null | undefined;

export type BrandedFormPathLeaves<
	TObj extends Record<string, unknown>,
	TType = any,
	TKey = FormPathLeaves<TObj>
> = TKey extends `${infer K}.length`
	? NonNullable<FormPathType<TObj, K>> extends BrandedType
		? NonNullable<FormPathType<TObj, K>> extends TType
			? K
			: never
		: never
	: never;

export type NonBrandedFormPathLeaves<
	TObj extends Record<string, unknown>,
	TType = any,
	TKey = FormPathLeaves<TObj, TType>
> = TKey extends `${infer K}.length` ? (NonNullable<FormPathType<TObj, K>> extends BrandedType ? never : TKey) : TKey;

export type IncludeBrandedFormPathLeaves<TObj extends Record<string, unknown>, TType = any> =
	| NonBrandedFormPathLeaves<TObj, TType>
	| BrandedFormPathLeaves<TObj, TType>;

export type IncludeBrandedFormPathLeavesWithErrors<
	TObj extends Record<string, unknown>,
	TKey = FormPathLeavesWithErrors<TObj>
> = TKey extends `${infer K}.length` ? (NonNullable<FormPathType<TObj, K>> extends BrandedType ? K : never) : TKey;

/**
 * Functions
 */

/**
 * Creates a view transition.
 * @param {ViewTransitionCallback} action - The callback function to be executed during the transition.
 * @returns {ViewTransition | undefined} - Returns the result of the view transition
 */
export const createTransition = (action: ViewTransitionCallback) => {
	if (!document.startViewTransition) {
		action();
		return;
	}
	return document.startViewTransition(action);
};

export function joinStringList(list: string[], separator = ", ", lastSeparator = "and ") {
	if (list.length < 2) return list.join("");
	const last = list.pop();
	return `${list.join(separator)}${list.length > 1 ? separator : " "}${lastSeparator}${last}`;
}

export function isDefined<T>(value?: T | null): value is T {
	return value !== undefined && value !== null;
}

/**
 * Classes
 */

export type SaveResult<T extends object | null, S extends Record<string, unknown>> = Promise<T | SaveError<S>>;

export class SaveError<TOut extends Record<string, unknown>, TIn extends Record<string, unknown> = TOut> {
	public status: NumericRange<400, 599> = 500;

	constructor(
		public error: string,
		protected options?: Partial<{
			field: "" | IncludeBrandedFormPathLeavesWithErrors<TOut>;
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
		if (err instanceof SaveError) return err;
		if (typeof err === "string") return new SaveError<TOut, TIn>(err);
		if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
			return new SaveError<TOut, TIn>(err.message);
		}
		return new SaveError<TOut, TIn>("An unknown error has occurred.");
	}

	/**
	 * Adds the error message to the form.
	 * @param form - The validated form to convert.
	 * @returns The form with error messages.
	 */
	toForm(form: SuperValidated<TOut, App.Superforms.Message, TIn>) {
		return isDefined(this.options?.field)
			? setError(form, this.options.field as FormPathLeavesWithErrors<TOut>, this.error, {
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

export const parseError = (e: unknown) => {
	if (e instanceof Error) return e.message;
	if (typeof e === "string") return e;
	if (typeof e === "object") return JSON.stringify(e);
	return "Unknown error";
};
