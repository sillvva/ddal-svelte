import { getCharacters } from "$src/server/data/characters";
import { redirect } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";

const defaultCookie = {
	magicItems: false
};

export const load = (async (event) => {
	const session = await event.locals.getSession();
	if (!session?.user) throw redirect(301, "/");
	const characters = await getCharacters(session.user.id);
	const cookie = JSON.parse(event.cookies.get("characters") || JSON.stringify(defaultCookie)) as typeof defaultCookie;
	return {
		characters,
		...cookie
	};
}) satisfies PageServerLoad;
