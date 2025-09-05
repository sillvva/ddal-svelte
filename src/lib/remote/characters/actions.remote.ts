import { command } from "$app/server";
import { characterIdSchema } from "$lib/schemas";
import { runSafe } from "$lib/server/effect/runtime";
import { assertAuth } from "$lib/server/effect/services/auth";
import { CharacterService } from "$lib/server/effect/services/characters";

export const deleteCharacter = command(characterIdSchema, (id) =>
	runSafe(function* () {
		const { user } = yield* assertAuth();
		const Characters = yield* CharacterService;
		return yield* Characters.set.delete(id, user.id);
	})
);
