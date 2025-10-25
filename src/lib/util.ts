import { wait } from "@sillvva/utils";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { hotkey as hk, type HotkeyItem } from "@svelteuidev/composables";
import type { Attachment } from "svelte/attachments";

export async function createTransition(action: ViewTransitionCallback, after?: () => void | Promise<void>, afterDelay = 0) {
	if (!document.startViewTransition) action();
	else document.startViewTransition(action);
	if (after) wait(afterDelay).then(after);
}

export function hotkey(hotkeys: HotkeyItem[]): Attachment<HTMLElement | Document> {
	return (node: HTMLElement | Document) => {
		if (node instanceof Document) node = node.body;
		return hk(node, hotkeys).destroy;
	};
}

export function getTrace(error: string) {
	const parts = error.split(/\n\s+\b/).map((part) => part.trim());
	const message = String(parts.shift());
	const stack = parts.join("\n");
	return { message, stack };
}

export function getRelativeTime(date: Date | number, lang = navigator.language): string {
	const stripTime = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

	const dateObj = new Date(date);
	const day = 86400;
	const today = stripTime(new Date());
	const targetDay = stripTime(dateObj);
	const last24Hours = Date.now() - dateObj.getTime() <= day * 1000;
	const deltaMs = +today - +targetDay;
	const deltaSeconds = Math.round(deltaMs / 1000);
	const dayDiff = Math.round(deltaSeconds / day);

	if (dayDiff === 0) return `today at ${dateObj.toLocaleTimeString(lang)}`;
	if (last24Hours) return `yesterday at ${dateObj.toLocaleTimeString(lang)}`;
	if (dayDiff < 0) return `in the future`;

	const cutoffs = [day * 7, day * 30];
	const units: Intl.RelativeTimeFormatUnit[] = ["day", "week"];
	const unitIndex = cutoffs.findIndex((cutoff) => cutoff > Math.abs(deltaSeconds));

	const divisor = cutoffs[unitIndex - 1] ?? day;
	const unit = units[unitIndex];
	if (!unit) return "in the future";

	const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
	return rtf.format(-Math.floor(deltaSeconds / divisor), unit);
}

export function isStandardSchema(schema: object): schema is StandardSchemaV1 {
	return "~standard" in schema;
}

/**
 * Deeply compares two values to determine if they are equal.
 * Handles primitives, objects, arrays, dates, RegExp, Sets, and Maps.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns true if values are deeply equal, false otherwise
 */
export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;

	if (a === null || b === null) return false;
	if (a === undefined || b === undefined) return false;
	if (typeof a !== typeof b) return false;

	if (a instanceof Date && b instanceof Date) {
		return a.getTime() === b.getTime();
	}

	if (a instanceof RegExp && b instanceof RegExp) {
		return a.source === b.source && a.flags === b.flags;
	}

	if (a instanceof Set && b instanceof Set) {
		if (a.size !== b.size) return false;
		for (const aItem of a) {
			let found = false;
			for (const bItem of b) {
				if (deepEqual(aItem, bItem)) {
					found = true;
					break;
				}
			}
			if (!found) return false;
		}
		return true;
	}

	if (a instanceof Map && b instanceof Map) {
		if (a.size !== b.size) return false;
		for (const [key, val] of a) {
			if (!b.has(key) || !deepEqual(val, b.get(key))) {
				return false;
			}
		}
		return true;
	}

	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i], b[i])) return false;
		}
		return true;
	}

	if (typeof a === "object" && typeof b === "object") {
		const keysA = Object.keys(a as Record<string, unknown>);
		const keysB = Object.keys(b as Record<string, unknown>);

		if (keysA.length !== keysB.length) return false;

		for (const key of keysA) {
			if (!keysB.includes(key)) return false;

			const valA = (a as Record<string, unknown>)[key];
			const valB = (b as Record<string, unknown>)[key];

			if (!deepEqual(valA, valB)) return false;
		}

		return true;
	}

	// Primitives that didn't match with ===
	return false;
}
