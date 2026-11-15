import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import type { PathnameWithSearchOrHash, RouteIdWithSearchOrHash } from "$app/types";
import { getLocalTimeZone } from "@internationalized/date";
import { isObject, wait } from "@sillvva/utils";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { isHttpError } from "@sveltejs/kit";
import type { FullPathname } from "./constants";
import { errorToast } from "./factories.svelte";
import type { ClientEffectResult, EffectFailure } from "./server/effect/runtime";

export type IsAny<T> = 0 extends 1 & T ? true : false;

/** Non-negative integers strictly below `N`, as a union of literals. */
type LessThan<N extends number, Acc extends number[] = []> = N extends Acc["length"]
	? Exclude<Acc[number], undefined>
	: LessThan<N, [...Acc, Acc["length"]]>;

/**
 * Inclusive union of non-negative integer literals from `Start` through `End`.
 *
 * @example
 * const status: NumericRange<300, 599> = 400;
 */
export type NumericRange<Start extends number, End extends number> = Exclude<End | LessThan<End>, LessThan<Start>>;

export type HTMLEvent<T extends Element> = Event & {
	currentTarget: EventTarget & T;
};

export type Route = PathnameWithSearchOrHash | RouteIdWithSearchOrHash;
export type RouteArgs<R extends Route> = Parameters<typeof resolve<R>>;
export type RouteParams<R extends Route> = RouteArgs<R> extends [route: unknown, params: infer P] ? P : undefined;

/**
 * The `params` prop for a given `href`. Route IDs with dynamic segments require `params`;
 * pathnames and static route IDs take none.
 */
export type RouteParamsProp<R extends Route> =
	RouteArgs<R> extends [route: unknown, params: infer P] ? { params: P } : { params?: undefined };

/**
 * Distributes over every route so each crumb's `params` is checked against its own `href`.
 * Route IDs with dynamic segments require `params`; pathnames take none.
 */
export type Crumb<R extends Route = Route> = R extends Route ? { title: string; href: R } & RouteParamsProp<R> : never;

/**
 * Distributes over every route so each option's `params` is checked against its own `href`.
 * Route IDs with dynamic segments require `params`; pathnames take none.
 */
export type SplitButtonOption<R extends Route = Route> = R extends Route
	? { href: R; label: string } & RouteParamsProp<R>
	: never;

export function resolveRoute<R extends Route>(href: R, params?: unknown) {
	return resolve(...([href, params].filter((arg) => arg !== undefined) as RouteArgs<R>));
}

/** Serializable route target for command-tray items (resolved on the client). */
export type CommandTrayLink<R extends Route = Route> = R extends Route ? { href: R } & RouteParamsProp<R> : never;

/** Resolve a command-tray link on the client so paths respect the current page URL. */
export function resolveCommandTrayLink(link: CommandTrayLink) {
	return resolveRoute(link.href, link.params);
}

export async function createTransition(action: ViewTransitionCallback, after?: () => Awaitable<void>, afterDelay = 0) {
	if (!document.startViewTransition) action();
	else document.startViewTransition(action);
	if (after) wait(afterDelay).then(after);
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
	const unit = units[unitIndex] ?? "day";

	const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
	return rtf.format(-Math.floor(deltaSeconds / divisor), unit);
}

/** Latest id. Uuid v7 values sort in creation order. */
export function newestDraftId(ids: readonly string[]) {
	return ids.toSorted().at(-1) ?? "";
}

export function unknownErrorMessage(error: unknown): string {
	if (typeof error === "string") return error;
	else if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string")
		return error.message;
	else if (isHttpError(error)) return error.body.message;
	else return "An unknown error occurred";
}

export function formatDate(date: Date, timeZone: string | null) {
	const formatter = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
		timeZone: timeZone || getLocalTimeZone(),
		timeZoneName: timeZone && timeZone !== getLocalTimeZone() ? "short" : undefined
	});

	return formatter.format(date);
}

export function isStandardSchema(schema: unknown): schema is StandardSchemaV1 {
	return isObject(schema) && "~standard" in schema;
}

export function isRedirectFailure<E extends { status: number; redirectTo?: unknown }>(
	error: E
): error is E & { redirectTo: FullPathname & {} } {
	return Boolean(error.redirectTo && typeof error.redirectTo === "string" && error.status >= 301 && error.status <= 308);
}

export function isValidationError(
	error: EffectFailure["error"]
): error is EffectFailure["error"] & { defect: NamedError<"ValidationError"> } {
	return Boolean(error.name === "ValidationError" && error.type === "Die");
}

export async function parseEffectResult<T>(result: ClientEffectResult<T>) {
	if (result.ok) return result.data;

	errorToast(result.error.message);
	if (isRedirectFailure(result.error)) {
		try {
			await goto(result.error.redirectTo);
		} catch {
			window.location.href = result.error.redirectTo;
		}
	}
}
