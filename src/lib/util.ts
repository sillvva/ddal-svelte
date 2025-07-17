import { wait } from "@sillvva/utils";
import { hotkey as hk, type HotkeyItem } from "@svelteuidev/composables";
import type { Attachment } from "svelte/attachments";
import type { setupViewTransition } from "sveltekit-view-transition";

/**
 * Types
 */

export type TransitionAction = ReturnType<typeof setupViewTransition>["transition"];

export type ModuleData = {
	getPageTitle?: (data: App.PageData & Record<string, any>) => string;
	pageTitle?: string;
	getHeadData?: (data: App.PageData & Record<string, any>) => {
		title: string;
		description?: string;
		image?: string;
	};
	headTitle?: string;
	headDescription?: string;
	headImage?: string;
};

/**
 * Functions
 */

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
