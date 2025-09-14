import { wait } from "@sillvva/utils";
import { hotkey as hk, type HotkeyItem } from "@svelteuidev/composables";
import type { Attachment } from "svelte/attachments";

export type Awaitable<T> = T | PromiseLike<T>;

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
