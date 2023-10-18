import { clearUserCache } from "$src/server/actions/users.js";
import { signInRedirect } from "$src/server/auth.js";
import { serverGetCookie } from "$src/server/cookie";
import { getCharacterCaches, getCharactersCache, type CharacterData } from "$src/server/data/characters";
import { redirect } from "@sveltejs/kit";

const defaultCookie = {
	magicItems: false,
	display: "list"
};

export const load = async (event) => {
	const session = event.locals.session;
	if (!session?.user) throw signInRedirect(event.url);

	const cookie = serverGetCookie(event.cookies, "characters", defaultCookie);

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
		characters,
		...cookie
	};
};

export const actions = {
	clearCaches: async (event) => {
		const session = await event.locals.session;
		if (!session?.user) throw redirect(301, "/");
		return await clearUserCache(session.user.id);
	}
};
