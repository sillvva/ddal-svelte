import { browser } from "$app/env";
import { logDraftDataSchema, logDraftIdSchema, type LogDraftData, type LogDraftId } from "#lib/schemas.js";
import * as v from "valibot";

const STORAGE_KEY = "ddal.log-draft";

/** The one draft this browser will offer on a character's new log form. */
export interface StoredLogDraft {
	id: LogDraftId;
	data: LogDraftData;
	/** Epoch ms. The browser copy is dropped at the same time the server draft expires. */
	expiresAt: number;
}

const storedSchema = v.object({
	id: logDraftIdSchema,
	data: logDraftDataSchema,
	expiresAt: v.number()
});

let current = $state.raw<StoredLogDraft | null>(null);

function parseStored(raw: string): StoredLogDraft | null {
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		return null;
	}
	const parsed = v.safeParse(storedSchema, json);
	if (!parsed.success || parsed.output.expiresAt <= Date.now()) return null;
	return parsed.output;
}

function load() {
	if (!browser) return;
	const raw = localStorage.getItem(STORAGE_KEY);
	current = raw ? parseStored(raw) : null;
	if (raw && !current) localStorage.removeItem(STORAGE_KEY);
}

function save(draft: StoredLogDraft) {
	if (!browser) return;
	const stored = parseStored(JSON.stringify(draft));
	if (!stored) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
	current = stored;
}

function clear() {
	if (!browser) return;
	localStorage.removeItem(STORAGE_KEY);
	current = null;
}

/**
 * Browser copy of a shared draft. Module state is only written in the browser, so SSR never
 * sees a draft. Markup that depends on it must wait until it has hydrated.
 */
export function logDraftMemory() {
	return {
		get current() {
			return current;
		},
		load,
		save,
		clear
	};
}
