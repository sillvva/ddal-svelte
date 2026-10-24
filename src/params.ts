import { defineParams } from "@sveltejs/kit/params";
import type { CharacterIdParam, DungeonMasterId, LogIdParam } from "#lib/schemas.js";

const uuidV7 = /^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[\da-f]{4}-[\da-f]{12}$/iu;

const matchCharacterId = (param: string): param is CharacterIdParam => param === "new" || uuidV7.test(param);

const matchDMId = (param: string): param is DungeonMasterId => uuidV7.test(param);

const matchLogId = (param: string): param is LogIdParam => param === "new" || uuidV7.test(param);

export const params = defineParams({
	CharacterId: (param) => (matchCharacterId(param) ? param : undefined),
	DMId: (param) => (matchDMId(param) ? param : undefined),
	LogId: (param) => (matchLogId(param) ? param : undefined)
});
