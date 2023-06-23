import { serverGetCookie } from "$src/server/cookie";
import { getCharacters } from "$src/server/data/characters";
import { redirect } from "@sveltejs/kit";

const defaultCookie = {
	magicItems: false,
	display: "list"
};

export const load = async (event) => {
	const session = await event.locals.getSession();
	if (!session?.user) throw redirect(301, "/");
	const characters = await getCharacters(session.user.id);
	const cookie = serverGetCookie(event.cookies, "characters", defaultCookie);
	return {
		characters,
		...cookie
	};
};
