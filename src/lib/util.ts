import { dev } from "$app/environment";
import { error, fail } from "@sveltejs/kit";
import type { SuperValidated } from "sveltekit-superforms";
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

export function isDefined<T>(value?: T): value is T {
	return value !== undefined;
}

/*
MIT License

Copyright (c) 2023 Andreas Söderlund

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/* eslint-disable @typescript-eslint/no-explicit-any */

export type PathData = {
	parent: any;
	key: string;
	value: any;
	path: (string | number | symbol)[];
	isLeaf: boolean;
	set: (value: any) => "skip";
};

function setPath<T extends object>(parent: T, key: keyof T, value: any) {
	parent[key] = value;
	return "skip" as const;
}

export function traversePath<T extends object>(
	obj: T,
	realPath: (string | number | symbol)[],
	modifier?: (data: PathData) => undefined | unknown | void
): PathData | undefined {
	if (!realPath.length) return undefined;
	const path = [realPath[0]];

	let parent = obj;

	while (path.length < realPath.length) {
		const key = path[path.length - 1] as keyof typeof parent;

		const value = modifier
			? modifier({
					parent,
					key: String(key),
					value: parent[key],
					path: path.map((p) => String(p)),
					isLeaf: false,
					set: (v) => setPath(parent, key, v)
				})
			: parent[key];

		if (value === undefined) return undefined;
		else parent = value as T;

		path.push(realPath[path.length]);
	}

	if (!parent) return undefined;

	const key = realPath[realPath.length - 1];
	return {
		parent,
		key: String(key),
		value: parent[key as keyof typeof parent],
		path: realPath.map((p) => String(p)),
		isLeaf: true,
		set: (v) => setPath(parent, key as keyof typeof parent, v)
	};
}

export function setPaths(
	obj: Record<string, unknown>,
	paths: (string | number | symbol)[][],
	value: NonNullable<unknown> | ((path: (string | number | symbol)[], data: PathData) => unknown) | null | undefined
) {
	const isFunction = typeof value === "function";

	for (const path of paths) {
		const leaf = traversePath(obj, path, ({ parent, key, value }) => {
			if (value === undefined || typeof value !== "object") {
				// If a previous check tainted the node, but the search goes deeper,
				// so it needs to be replaced with a (parent) node
				parent[key] = {};
			}
			return parent[key];
		});
		if (leaf) leaf.parent[leaf.key] = isFunction ? value(path, leaf) : value;
	}
}

export function fieldError<TForm extends Record<string, unknown>, TSaveErr extends Record<string, unknown>>(
	form: SuperValidated<TForm>,
	error: SaveError<TSaveErr>
) {
	const path = error.options?.field
		?.replace(/\[(\d+)]/g, ".$1")
		.split(".")
		.map((p) => (isNaN(Number(p)) ? p : Number(p)));
	if (!path) return;
	setPaths(form.errors, [path], [error.error]);
	return fail(error.status, { form });
}
