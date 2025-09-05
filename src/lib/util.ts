import { goto } from "$app/navigation";
import type { Pathname } from "$app/types";
import { wait } from "@sillvva/utils";
import { hotkey as hk, type HotkeyItem } from "@svelteuidev/composables";
import type { Attachment } from "svelte/attachments";
import { errorToast } from "./factories.svelte";
import type { EffectFailure, EffectResult } from "./server/effect/runtime";

export type Awaitable<T> = T | Promise<T>;

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

export function removeTrace(message: string) {
	return message.replace(/\n\s+at .+/g, "");
}

export type Crumb = {
	title: string;
	url: string;
};
export type PageHead = {
	title: string;
	description?: string;
	image?: string;
};
export type ModuleData = {
	pageTitle?: string;
	getPageTitle?: (data: unknown) => string;
	pageHead?: PageHead;
	getPageHead?: (data: unknown) => Partial<PageHead>;
};
export const routeModules: Record<string, ModuleData> = import.meta.glob("/src/routes/**/+page.svelte", {
	eager: true
});

export function isRedirectFailure(
	error: EffectFailure["error"]
): error is EffectFailure["error"] & { extra: { redirectTo: Pathname & {} } } {
	return Boolean(error.extra.redirectTo && typeof error.extra.redirectTo === "string" && error.status <= 308);
}

export async function parseEffectResult<T>(result: EffectResult<T>) {
	if (result.ok) return result.data;

	errorToast(result.error.message);
	if (isRedirectFailure(result.error)) {
		await goto(result.error.extra.redirectTo);
	}
}
