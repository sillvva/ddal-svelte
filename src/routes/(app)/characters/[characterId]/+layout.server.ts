import { characterIdSchema } from "$lib/schemas.js";
import { rateLimiter } from "$server/cache.js";
import { getCharacterCache } from "$server/data/characters";
import { error } from "@sveltejs/kit";
import { parse } from "valibot";

export const load = async (event) => {
	const parent = await event.parent();

	const { success } = await rateLimiter("fetch", parent.session?.user?.id || event.getClientAddress());
	if (!success) error(429, "Too Many Requests");

	const characterId = parse(characterIdSchema, event.params.characterId);
	const character = await getCharacterCache(characterId);

	return {
		breadcrumbs: parent.breadcrumbs.concat({
			name: character?.name || "New Character",
			href: `/characters/${character?.id || "new"}`
		}),
		character
	};
};
