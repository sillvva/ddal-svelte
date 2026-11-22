import type { CharacterId, LogId } from "#lib/schemas.js";
import { v7 } from "uuid";
import { describe, expect, it } from "vitest";
import { characterLogDraftCacheKey, characterNewLogFromDraftPath } from "./log-draft-character-pick";

describe("characterLogDraftCacheKey", () => {
	it("uses the newest log id when present", () => {
		const characterId = v7() as CharacterId;
		const older = v7() as LogId;
		const newer = v7() as LogId;
		expect(characterLogDraftCacheKey({ id: characterId, logs: [{ id: older }, { id: newer }] })).toBe(newer);
	});

	it("falls back to the character id when there are no logs", () => {
		const characterId = v7() as CharacterId;
		expect(characterLogDraftCacheKey({ id: characterId, logs: [] })).toBe(characterId);
	});
});

describe("characterNewLogFromDraftPath", () => {
	it("builds the same new-log route as New Log from Draft", () => {
		const characterId = v7() as CharacterId;
		const logId = v7() as LogId;
		const path = characterNewLogFromDraftPath({ id: characterId, logs: [{ id: logId }] });
		expect(path).toBe(`/characters/${characterId}/log/new?draft=${encodeURIComponent(logId)}&fromDraft=1`);
	});
});
