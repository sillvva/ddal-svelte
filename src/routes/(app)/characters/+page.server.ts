import { assertUser } from "$lib/schemas.js";
import { getUserCharacters } from "$server/data/characters";
import { fetchWithFallback } from "$server/db/effect";

export const load = async (event) => {
	const user = event.locals.user;
	assertUser(user, event.url);

	const characters = await fetchWithFallback(getUserCharacters(user.id, true), () => []);

	return {
		title: `${user.name}'s Characters`,
		characters
	};
};
