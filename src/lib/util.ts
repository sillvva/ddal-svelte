import { dev } from "$app/environment";
import { type NumericRange } from "@sveltejs/kit";
import { message, setError, type FormPathLeavesWithErrors, type SuperValidated } from "sveltekit-superforms";
import type { setupViewTransition } from "sveltekit-view-transition";

/**
 * Types
 */

export type Prettify<T> = {
	[K in keyof T]: T[K];
} & unknown;

declare const __brand: unique symbol;
type BrandKey = keyof Brand<unknown> extends symbol ? never : keyof Brand<unknown>;
type Brand<B> = { [__brand]: B };
export type Branded<T, B> = T & Brand<B>;
export type ExtractBrand<K> = K extends `${infer N}.${"length" | BrandKey}` ? N : K;

export type TransitionAction = ReturnType<typeof setupViewTransition>["transition"];

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

export type SaveResult<T extends object | null, S extends Record<string, unknown>> = Promise<T | SaveError<S>>;

export class SaveError<TOut extends Record<string, unknown>, TIn extends Record<string, unknown> = TOut> {
	public status: NumericRange<400, 599> = 500;

	constructor(
		public error: string,
		protected options?: Partial<{
			field: "" | ExtractBrand<FormPathLeavesWithErrors<TOut>>;
			status: NumericRange<400, 599>;
		}>
	) {
		if (options?.status) this.status = options.status;
	}

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
