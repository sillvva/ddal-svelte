import { authRedirect } from "$lib/server/effect";
import { withCharacter } from "$lib/server/effect/characters.js";

export const load = () =>
	authRedirect(function* ({ user }) {
		const characters = yield* withCharacter((service) => service.get.userCharacters(user.id));

		return {
			characters
		};
	});
