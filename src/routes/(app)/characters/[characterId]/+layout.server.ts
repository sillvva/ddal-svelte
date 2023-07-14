import { getCharacter } from "$src/server/data/characters.js";
import { error } from "@sveltejs/kit";

export const load = async (event) => {
	const parent = await event.parent();

	const character = await getCharacter(event.params.characterId);
	if (!character) throw error(404, "Character not found");

	return {
		breadcrumbs: character ? parent.breadcrumbs.concat(
			{
				name: character.name || "New Character",
				href: `/characters/${character.id}`
			}
		) : parent.breadcrumbs,
		character
	};
};
