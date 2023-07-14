import { deleteCharacter } from "$src/server/actions/characters";
import { deleteLog } from "$src/server/actions/logs";
import { serverGetCookie } from "$src/server/cookie";
import { redirect } from "@sveltejs/kit";

const defaultCookie = {
	descriptions: false
};

export const load = async (event) => {
	if (event.params.characterId === "new") throw redirect(301, "/characters/new/edit");

	const parent = await event.parent();
	const character = parent.character;

	const cookie = serverGetCookie(event.cookies, "characters", defaultCookie);

	return {
		title: character.name,
		description: `Level ${character.total_level} ${character.race} ${character.class}`.replace(/ {2,}/g, " ").trim(),
		image: character.image_url,
		character,
		...cookie
	};
};

export const actions = {
	deleteCharacter: async (event) => {
		const session = await event.locals.getSession();
		if (!session?.user) throw redirect(301, "/");
		const characterId = event.params.characterId;
		const result = await deleteCharacter(characterId, session.user.id);
		if (result) {
			if (result.id) throw redirect(301, "/characters");
			if (result.error) throw new Error(result.error);
		}
		return result;
	},
	deleteLog: async (event) => {
		const session = await event.locals.getSession();
		if (!session?.user) throw redirect(301, "/");
		const data = await event.request.formData();
		const logId = (data.get("logId") || "") as string;
		return await deleteLog(logId, session.user.id);
	}
};
