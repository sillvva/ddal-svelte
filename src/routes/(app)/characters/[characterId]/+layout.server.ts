import { characterIdSchema } from "$lib/schemas.js";
import { getCharacter } from "$server/data/characters";
import { parse } from "valibot";

export const load = async (event) => {
	const parent = await event.parent();
	const characterId = parse(characterIdSchema, event.params.characterId);
	const character = await getCharacter(characterId);

	return {
		breadcrumbs: parent.breadcrumbs.concat({
			name: character?.name || "New Character",
			href: `/characters/${character?.id || "new"}`
		}),
		character
	};
};
