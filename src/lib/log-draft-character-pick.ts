import type { CharacterId } from "#lib/schemas.js";

export const LOG_DRAFT_CHARACTER_STORAGE_KEY = "ddal.log-draft-character";

type CharacterDraftLogs = { id: CharacterId; logs: readonly { id: string }[] };

/** Latest id. Uuid v7 values sort in creation order. */
function newestLogId(ids: readonly string[]) {
	return ids.toSorted().at(-1) ?? "";
}

/** Remote-query cache key for a character's new-log form, matching the character page. */
export function characterLogDraftCacheKey(character: CharacterDraftLogs) {
	return newestLogId(character.logs.map((log) => log.id)) || character.id;
}

/** Same query string as **New Log from Draft** on a character page. */
export function characterNewLogFromDraftPath(character: CharacterDraftLogs) {
	const draft = encodeURIComponent(characterLogDraftCacheKey(character));
	return `/characters/${character.id}/log/new?draft=${draft}&fromDraft=1` as const;
}
