import { assertAuth } from "$server/auth";
import { run } from "$server/effect";
import { withCharacter } from "$server/effect/characters.js";

export const load = (event) =>
	run(function* () {
		const user = yield* assertAuth();

		const characters = yield* withCharacter((service) => service.get.userCharacters(user.id, true));

		return {
			characters
		};
	});
