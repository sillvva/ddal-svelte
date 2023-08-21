import { signInRedirect } from "$src/server/auth.js";
import { serverGetCookie } from "$src/server/cookie";
import { getCharacterCaches, getCharactersCache } from "$src/server/data/characters";

import type { CharacterData } from "$src/server/data/characters";
const defaultCookie = {
	magicItems: false,
	display: "list"
};

export const load = async (event) => {
	const parent = await event.parent();

	const session = parent.session;
	if (!session?.user) throw signInRedirect(event.url);

	const cookie = serverGetCookie(event.cookies, "characters", defaultCookie);

	const characters = await getCharactersCache(session.user.id).then(async (characters) => {
		const charData: CharacterData[] = [];
		const caches = await getCharacterCaches(characters.map((c) => c.id));
		for (const data of caches) {
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
