import { characterIdSchema } from "#lib/schemas.js";
import { guardedCommand } from "#lib/server/effect/guarded.js";
import { CharacterService } from "#lib/server/effect/services/characters.js";

export const deleteCharacter = guardedCommand(characterIdSchema, function* (id, { user }) {
	const Characters = yield* CharacterService;
	return yield* Characters.delete(id, user.id);
});
