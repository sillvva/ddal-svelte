import { assertUser } from "$lib/schemas.js";
import { getUserCharacters } from "$server/data/characters";
import { fetchWithFallback } from "$server/db/effect";

export const load = async (event) => {
	const session = event.locals.session;
	assertUser(session?.user, event.url);

	const characters = await fetchWithFallback(getUserCharacters(session.user.id, true), () => []);

	return {
		title: `${session.user.name}'s Characters`,
		characters
	};
};
