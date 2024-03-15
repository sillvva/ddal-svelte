import { rateLimiter } from "$server/cache.js";
import { getCharacterCache } from "$server/data/characters";
import { error } from "@sveltejs/kit";

export const load = async (event) => {
	const parent = await event.parent();

	const { success } = await rateLimiter("fetch", parent.session?.user?.id || event.getClientAddress());
	if (!success) error(429, "Too Many Requests");

	const character = await getCharacterCache(event.params.characterId);

	return {
		breadcrumbs: parent.breadcrumbs.concat({
			name: character?.name || "New Character",
			href: `/characters/${character?.id || "new"}`
		}),
		character
	};
};
