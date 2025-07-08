import type { Passkey } from "$server/db/schema";
import { wait } from "@sillvva/utils";
import { hotkey as hk, type HotkeyItem } from "@svelteuidev/composables";
import type { Attachment } from "svelte/attachments";
import type { setupViewTransition } from "sveltekit-view-transition";

/**
 * Types
 */

export type TransitionAction = ReturnType<typeof setupViewTransition>["transition"];

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

export function authName(passkey: Passkey) {
	return passkey.name || passkey.credentialID.replace(/[^a-z0-9]/gi, "").slice(-8);
}
