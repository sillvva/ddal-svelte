import { serverGetCookie } from "$src/server/cookie";
import { getCharacterCache, getCharactersCache } from "$src/server/data/characters";
import { redirect } from "@sveltejs/kit";

import type { CharacterData } from "$src/server/data/characters";

const defaultCookie = {
	magicItems: false,
	display: "list",
	cacheCharacters: false
};

export const load = async (event) => {
	const parent = await event.parent();

	const session = parent.session;
	if (!session?.user) throw redirect(301, "/");

	const cookie = serverGetCookie(event.cookies, "characters", defaultCookie);

	const characters = await getCharactersCache(session.user.id).then(async (characters) => {
		const charData: CharacterData[] = [];
		for (const character of characters) {
			const data = await getCharacterCache(character.id);
			if (data) charData.push(data);
		}
		return charData;
	});

	return {
		title: `${session.user.name}'s Characters`,
		characters,
		...cookie
	};
};
