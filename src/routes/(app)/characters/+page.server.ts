import { clearUserCache } from "$src/server/actions/users.js";
import { signInRedirect } from "$src/server/auth.js";
import { getCharacterCaches, getCharactersCache, type CharacterData } from "$src/server/data/characters";
import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const session = event.locals.session;
	if (!session?.user) signInRedirect(event.url);

	const characters = await getCharactersCache(session.user.id).then(async (characters) => {
		const charData: Array<CharacterData> = [];
		const caches = await getCharacterCaches(characters.map((c) => c.id));
		for (const data of caches) {
			if (data) charData.push(data);
		}
		return charData;
	});

	return {
		title: `${session.user.name}'s Characters`,
		characters
	};
};

export const actions = {
	clearCaches: async (event) => {
		const session = await event.locals.session;
		if (!session?.user) redirect(302, "/");
		return await clearUserCache(session.user.id);
	}
};
