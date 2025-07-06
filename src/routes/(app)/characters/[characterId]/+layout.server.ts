import { characterIdSchema } from "$lib/schemas.js";
import { getCharacter } from "$server/data/characters";
import { fetchWithFallback } from "$server/db/effect";
import { parse } from "valibot";

export const load = async (event) => {
	const parent = await event.parent();
	const characterId = parse(characterIdSchema, event.params.characterId);
	const character = await fetchWithFallback(getCharacter(characterId), () => undefined);

	return {
		breadcrumbs: parent.breadcrumbs.concat({
			name: character?.name || "New Character",
			href: `/characters/${character?.id || "new"}`
		}),
		character
	};
};
