import { assertAuth } from "$lib/server/auth";
import { run } from "$lib/server/effect";
import { withCharacter } from "$lib/server/effect/characters.js";

export const load = (event) =>
	run(function* () {
		const user = yield* assertAuth();

		const characters = yield* withCharacter((service) => service.get.userCharacters(user.id, true));

		return {
			characters
		};
	});
