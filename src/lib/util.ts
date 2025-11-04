import { wait } from "@sillvva/utils";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { hotkey as hk, type HotkeyItem } from "@svelteuidev/composables";
import { getContext, hasContext, setContext } from "svelte";
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

export function createContext<T>(createDefault?: () => T): [(getDefault?: () => T) => T, (context: T) => T] {
	const key = Symbol("context");
	return [
		(getDefault) => {
			if (hasContext(key)) return getContext(key);
			if (getDefault) return setContext(key, getDefault());
			if (createDefault) return setContext(key, createDefault());
			throw new Error("Context not found");
		},
		(context) => setContext(key, context)
	];
}
