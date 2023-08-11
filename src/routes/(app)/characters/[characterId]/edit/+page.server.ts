import { saveCharacter } from "$src/server/actions/characters";
import { error, redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const parent = await event.parent();

	const session = parent.session;
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
		if (!parent.character) throw error(404, "Character not found");
		character.name = parent.character.name;
		character.campaign = parent.character.campaign || "";
		character.race = parent.character.race || "";
		character.class = parent.character.class || "";
		character.character_sheet_url = parent.character.character_sheet_url || "";
		character.image_url = parent.character.image_url || "";
	}

	return {
		title: event.params.characterId === "new" ? "New Character" : `Edit ${character.name}`,
		breadcrumbs: parent.breadcrumbs.concat({
			name: event.params.characterId === "new" ? "New Character" : "Edit",
			href: `/characters/${event.params.characterId}/edit`
		}),
		...event.params,
		character
	};
};

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
};
