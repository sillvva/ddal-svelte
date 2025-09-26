import { characterIdSchema } from "$lib/schemas";
import { guardedCommand } from "$lib/server/effect/remote";
import { CharacterService } from "$lib/server/effect/services/characters";

export const deleteCharacter = guardedCommand(characterIdSchema, function* (id, { user }) {
	const Characters = yield* CharacterService;
	return yield* Characters.set.delete(id, user.id);
});
