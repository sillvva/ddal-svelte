import { getCharacter } from "$src/server/data/characters";

export const load = async (event) => {
	const parent = await event.parent();
	const character = await getCharacter(event.params.characterId);

	return {
		breadcrumbs: character
			? parent.breadcrumbs.concat({
					name: character.name || "New Character",
					href: `/characters/${character.id}`
			  })
			: parent.breadcrumbs,
		character
	};
};
