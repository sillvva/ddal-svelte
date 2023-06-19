import { serverGetCookie } from "$server/cookie";
import { getCharacters } from "$server/data/characters";
import { redirect } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";
const defaultCookie = {
	magicItems: false
};

export const load = (async (event) => {
	const session = await event.locals.getSession();
	if (!session?.user) throw redirect(301, "/");
	const characters = await getCharacters(session.user.id);
	const cookie = serverGetCookie(event.cookies, "characters", defaultCookie);
	return {
		characters,
		...cookie
	};
}) satisfies PageServerLoad;
