import { error } from "@sveltejs/kit";
import type { setupViewTransition } from "sveltekit-view-transition";
import { twMerge } from "tailwind-merge";

export function handleSKitError(err: unknown) {
	if (
		err &&
		typeof err == "object" &&
		"status" in err &&
		typeof err.status == "number" &&
		"body" in err &&
		typeof err.body == "string"
	) {
		error(err.status, err.body);
	}
}

export type Prettify<T> = {
	[K in keyof T]: T[K];
} & unknown;

export type TransitionAction = ReturnType<typeof setupViewTransition>["transition"];

export const stopWords = new Set(["and", "or", "to", "in", "a", "the", "of"]);

export const parseError = (e: unknown) => {
	if (e instanceof Error) return e.message;
	if (typeof e === "string") return e;
	if (typeof e === "object") return JSON.stringify(e);
	return "Unknown error";
};

/**
 * Converts a given text into a slug.
 * @param text - The text to be slugified.
 * @returns The slugified version of the text.
 */
export const slugify = (text: string) => {
	return text
		.toString()
		.normalize("NFD") // split an accented letter in the base letter and the acent
		.replace(/[\u0300-\u036f]/g, "") // remove all previously split accents
		.toLowerCase()
		.trim()
		.replace(/\s+/g, "-")
		.replace(/[^\w-]+/g, "")
		.replace(/--+/g, "-");
};

export const tooltipClasses = (text?: string | null, align = "center") => {
	if (!text) return "";
	return twMerge(
		"before:hidden before:lg:block before:max-h-[50vh] before:overflow-hidden before:text-ellipsis",
		"before:z-20 before:whitespace-normal before:![content:attr(data-tip)]",
		align == "left" && "before:left-0 before:translate-x-0",
		align == "right" && "before:right-0 before:translate-x-0",
		text.trim() && "tooltip"
	);
};

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
/**
 * Sorts two values of type string, number, or Date.
 *
 * @param a - The first value to compare.
 * @param b - The second value to compare.
 * @returns A negative number if `a` is less than `b`, a positive number if `a` is greater than `b`, or 0 if they are equal.
 *
 * @example
 * ```javascript
 * const fruits = ["apple", "Banana", "Orange", "banana"];
 * fruits.sort(sorter);
 * console.log(fruits);
 * // Output: ["apple", "banana", "Banana", "Orange"]
 * ```
 */
export const sorter = (a: string | number | Date, b: string | number | Date) => {
	if (typeof a === "string" && typeof b === "string") return collator.compare(a, b);
	if (typeof a === "number" && typeof b === "number") return a - b;
	if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
	return collator.compare(a.toString(), b.toString());
};

/**
 * Creates a transition for the view.
 * @param {ViewTransitionCallback} action - The callback function to be executed during the transition.
 * @returns {ViewTransition | undefined} - Returns the result of the transition action or void if the transition is not supported.
 */
export const createTransition = (action: ViewTransitionCallback) => {
	if (!document.startViewTransition) {
		action();
		return;
	}
	return document.startViewTransition(action);
};
