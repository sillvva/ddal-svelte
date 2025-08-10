import { CharacterService } from "$lib/server/effect/characters";
import { authRedirect } from "$lib/server/effect/runtime.js";

export const load = () =>
	authRedirect(function* (user) {
		const Characters = yield* CharacterService;
		const characters = yield* Characters.get.userCharacters(user.id);

		return {
			characters
		};
	});
