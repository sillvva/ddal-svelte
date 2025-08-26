import { runAuth } from "$lib/server/effect/runtime.js";
import { CharacterService } from "$lib/server/effect/services/characters";

export const load = () =>
	runAuth(function* (user) {
		const Characters = yield* CharacterService;
		const characters = yield* Characters.get.userCharacters(user.id);

		return {
			characters
		};
	});
