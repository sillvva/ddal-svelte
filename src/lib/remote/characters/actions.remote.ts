import { command } from "$app/server";
import { characterIdSchema } from "$lib/schemas";
import { runAuthSafe } from "$lib/server/effect/runtime";
import { CharacterService } from "$lib/server/effect/services/characters";

export const deleteCharacter = command(characterIdSchema, (id) =>
	runAuthSafe(function* (user) {
		const Characters = yield* CharacterService;
		return yield* Characters.set.delete(id, user.id);
	})
);
