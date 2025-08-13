import { command } from "$app/server";
import { characterIdSchema } from "$lib/schemas";
import { authReturn } from "$lib/server/effect/runtime";
import { CharacterService } from "$lib/server/effect/services/characters";

export default {
	delete: command(characterIdSchema, (id) =>
		authReturn(function* (user) {
			const Characters = yield* CharacterService;
			return yield* Characters.set.delete(id, user.id);
		})
	)
};
