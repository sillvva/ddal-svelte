import { browser } from "$app/env";
import { LOG_DRAFT_CHARACTER_STORAGE_KEY } from "#lib/log-draft-character-pick.js";
import { characterIdSchema, type CharacterId } from "#lib/schemas.js";
import * as v from "valibot";

export function readLastLogDraftCharacterId(): CharacterId | null {
	if (!browser) return null;
	const raw = localStorage.getItem(LOG_DRAFT_CHARACTER_STORAGE_KEY);
	if (!raw) return null;
	const parsed = v.safeParse(characterIdSchema, raw);
	return parsed.success ? parsed.output : null;
}

export function saveLastLogDraftCharacterId(id: CharacterId) {
	if (!browser) return;
	localStorage.setItem(LOG_DRAFT_CHARACTER_STORAGE_KEY, id);
}
