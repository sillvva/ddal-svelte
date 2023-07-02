import { deleteCharacter } from "$src/server/actions/characters";
import { deleteLog } from "$src/server/actions/logs";
import { serverGetCookie } from "$src/server/cookie";
import { getCharacter } from "$src/server/data/characters";
import { error, redirect } from "@sveltejs/kit";

const defaultCookie = {
	descriptions: false
};

export const load = async (event) => {
	if (event.params.characterId === "new") throw redirect(301, "/characters/new/edit");
	const character = await getCharacter(event.params.characterId);
	if (!character) throw error(404, "Character not found");
	const cookie = serverGetCookie(event.cookies, "characters", defaultCookie);
	return {
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
