import { assertUser } from "$server/auth";
import { runOrThrow } from "$server/effect";
import { withCharacter } from "$server/effect/characters.js";

export const load = async (event) => {
	const user = event.locals.user;
	assertUser(user);

	const characters = await runOrThrow(withCharacter((service) => service.getUserCharacters(user.id, true)));

	return {
		title: `${user.name}'s Characters`,
		characters
	};
};
