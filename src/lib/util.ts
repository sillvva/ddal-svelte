import { goto } from "$app/navigation";
import { wait } from "@sillvva/utils";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { hotkey as hk, type HotkeyItem } from "@svelteuidev/composables";
import { isObject } from "effect/Predicate";
import { tick } from "svelte";
import type { Attachment } from "svelte/attachments";
import type { FullPathname } from "./constants";
import { errorToast } from "./factories.svelte";
import type { EffectFailure, EffectResult } from "./server/effect/runtime";

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

export function download(params: () => { blob: Blob; filename: string }) {
	return (node: HTMLElement) => {
		const click = async () => {
			const { blob, filename } = params();
			try {
				const anchor = document.createElement("a");
				const url = URL.createObjectURL(blob);
				anchor.href = url;
				anchor.download = filename || "";
				document.body.appendChild(anchor);
				anchor.click();
				await tick();
				document.body.removeChild(anchor);
				URL.revokeObjectURL(url);
				node.dispatchEvent(new CustomEvent("download", { detail: { blob: blob, filename: filename } }));
			} catch {
				node.dispatchEvent(new CustomEvent("download-error", { detail: { blob: blob, filename: filename } }));
			}
		};
		node.addEventListener("click", click, true);
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

export function isStandardSchema(schema: unknown): schema is StandardSchemaV1 {
	return isObject(schema) && "~standard" in schema;
}

export function isRedirectFailure(
	error: EffectFailure["error"]
): error is EffectFailure["error"] & { redirectTo: FullPathname & {} } {
	return Boolean(error.redirectTo && typeof error.redirectTo === "string" && error.status >= 301 && error.status <= 308);
}

export function isValidationError(
	error: EffectFailure["error"]
): error is EffectFailure["error"] & { defect: NamedError<"ValidationError"> } {
	return Boolean(error.name === "ValidationError" && error.type === "Die");
}

export async function parseEffectResult<T>(result: EffectResult<T>) {
	if (result.ok) return result.data;

	errorToast(result.error.message);
	if (isRedirectFailure(result.error)) {
		await goto(result.error.redirectTo);
	}
}
