import { run } from "$lib/server/effect/runtime.js";
import { assertAuth } from "$lib/server/effect/services/auth";
import { CharacterService } from "$lib/server/effect/services/characters";

export const load = () =>
	run(function* () {
		const { user } = yield* assertAuth();
		const Characters = yield* CharacterService;

		const characters = yield* Characters.get.userCharacters(user.id);

		return {
			characters
		};
	});
