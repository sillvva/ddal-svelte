import { browser } from "$app/env";
import { logDraftDataSchema, logDraftIdSchema, type LogDraftData, type LogDraftId } from "#lib/schemas.js";
import * as v from "valibot";

const STORAGE_KEY = "ddal.log-draft";

/** The one draft this browser will offer on a character's new log form. */
export interface StoredLogDraft {
	id: LogDraftId;
	data: LogDraftData;
}

let current = $state.raw<StoredLogDraft | null>(null);
let hydrated = $state(false);

function parseStored(raw: string): StoredLogDraft | null {
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!json || typeof json !== "object") return null;
	const record = json as { id?: unknown; data?: unknown };
	const id = v.safeParse(logDraftIdSchema, record.id);
	const data = v.safeParse(logDraftDataSchema, record.data);
	if (!id.success || !data.success) return null;
	return { id: id.output, data: data.output };
}

function load() {
	if (!browser) return;
	hydrated = true;
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
	hydrated = true;
}

function clear() {
	if (!browser) return;
	localStorage.removeItem(STORAGE_KEY);
	current = null;
	hydrated = true;
}

/** Browser copy of a shared draft. Module state is only written in the browser. */
export function logDraftMemory() {
	return {
		get hydrated() {
			return hydrated;
		},
		get current() {
			return current;
		},
		load,
		save,
		clear
	};
}
