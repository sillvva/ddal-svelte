import { getCharacterCache } from "$server/data/characters";

export const load = async (event) => {
	const parent = await event.parent();
	const character = await getCharacterCache(event.params.characterId);

	return {
		breadcrumbs: parent.breadcrumbs.concat({
			name: character?.name || "New Character",
			href: `/characters/${character?.id || "new"}`
		}),
		character
	};
};
