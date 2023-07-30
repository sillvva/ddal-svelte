import { serverGetCookie } from "$src/server/cookie";
import { getCharacters } from "$src/server/data/characters";
import { redirect } from "@sveltejs/kit";

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

	return {
		title: `${session.user.name}'s Characters`,
		streamed: {
			characters: getCharacters(session.user.id)
		},
		...cookie
	};
};
