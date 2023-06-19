import { saveCharacter } from "$server/actions/characters";
import { getCharacter } from "$server/data/characters";
import { redirect } from "@sveltejs/kit";

import type { Actions, PageServerLoad } from "../$types";
export const load = (async (event) => {
	const session = await event.locals.getSession();
	if (!session?.user) throw redirect(301, "/");

	const character = {
		name: "",
		campaign: "",
		race: "",
		class: "",
		character_sheet_url: "",
		image_url: ""
	};
	if (event.params.characterId !== "new") {
		const data = await getCharacter(event.params.characterId, false);
		if (!data) throw redirect(301, "/characters");
		character.name = data.name;
		character.campaign = data.campaign || "";
		character.race = data.race || "";
		character.class = data.class || "";
		character.character_sheet_url = data.character_sheet_url || "";
		character.image_url = data.image_url || "";
	}

	return {
		character,
		...event.params
	};
}) satisfies PageServerLoad;

export const actions = {
	saveCharacter: async (event) => {
		const session = await event.locals.getSession();
		if (!session?.user) throw redirect(301, "/");
		const characterId = event.params.characterId;
		const data = await event.request.formData();
		const result = await saveCharacter(characterId, session.user.id, {
			name: data.get("name") as string,
			campaign: data.get("campaign") as string,
			race: data.get("race") as string,
			class: data.get("class") as string,
			character_sheet_url: data.get("character_sheet_url") as string,
			image_url: data.get("image_url") as string
		});
		if (result && result.id) throw redirect(301, `/characters/${result.id}`);
		return result;
	}
} satisfies Actions;
