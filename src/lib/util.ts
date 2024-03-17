import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";
import type { setupViewTransition } from "sveltekit-view-transition";
import { twMerge } from "tailwind-merge";
import { SaveError } from "./schemas";

export function handleSKitError(err: unknown) {
	if (
		err &&
		typeof err == "object" &&
		"status" in err &&
		typeof err.status == "number" &&
		"body" in err &&
		typeof err.body == "string"
	) {
		if (dev) console.error(err);
		error(err.status, err.body);
	}
}

export function handleSaveError<TObj extends Record<string, unknown>, TErr = SaveError<TObj>>(err: TErr | Error | unknown) {
	if (dev) console.error(err);
	if (err instanceof SaveError) return err;
	if (err instanceof Error) return new SaveError<TObj>(500, err.message);
	throw new SaveError<TObj>(500, "An unknown error has occurred.");
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

export const formatDate = (date: Date | string | number) => {
	const d = new Date(date);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	const hours = String(d.getHours()).padStart(2, "0");
	const minutes = String(d.getMinutes()).padStart(2, "0");
	const seconds = String(d.getSeconds()).padStart(2, "0");
	const milliseconds = String(d.getMilliseconds()).padStart(3, "0");
	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
};

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
