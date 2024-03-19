import { deleteCharacter } from "$server/actions/characters";
import { deleteLog } from "$server/actions/logs";
import { error, redirect } from "@sveltejs/kit";

export const load = async (event) => {
	if (event.params.characterId === "new") redirect(301, "/characters/new/edit");

	const parent = await event.parent();
	const character = parent.character;
	if (!character) error(404, "Character not found");

	return {
		title: character.name,
		description: `Level ${character.total_level} ${character.race} ${character.class}`.replace(/ {2,}/g, " ").trim(),
		image: character.imageUrl,
		character
	};
};

export const actions = {
	deleteCharacter: async (event) => {
		const session = await event.locals.session;
		if (!session?.user) redirect(302, "/");
		const characterId = event.params.characterId;
		const result = await deleteCharacter(characterId, session.user.id);
		if (result) {
			if (result.id) redirect(302, "/characters");
			if (result.error) error(400, result.error);
		}
		return result;
	},
	deleteLog: async (event) => {
		const session = await event.locals.session;
		if (!session?.user) redirect(302, "/");
		const data = await event.request.formData();
		const logId = (data.get("logId") || "") as string;
		return await deleteLog(logId, session.user.id);
	}
};
