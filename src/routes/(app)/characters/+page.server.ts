import { assertUser } from "$server/auth";
import { run } from "$server/effect";
import { withCharacter } from "$server/effect/characters.js";

export const load = (event) =>
	run(function* () {
		const user = event.locals.user;
		assertUser(user);

		const characters = yield* withCharacter((service) => service.get.userCharacters(user.id, true));

		return {
			title: `${user.name}'s Characters`,
			characters
		};
	});
