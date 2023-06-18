import { getCharacter } from "$src/server/data/characters";

import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
	const character = await getCharacter(event.params.characterId);
	return {
		character
	};
}) satisfies PageServerLoad;
