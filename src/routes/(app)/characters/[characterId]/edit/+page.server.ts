import { parseFormData } from "$src/lib/components/SchemaForm.svelte";
import { newCharacterSchema } from "$src/lib/types/schemas.js";
import { saveCharacter } from "$src/server/actions/characters";
import { signInRedirect } from "$src/server/auth.js";
import { error, redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const parent = await event.parent();

	const session = event.locals.session;
	if (!session?.user) throw signInRedirect(event.url);

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
		const session = await event.locals.session;
		if (!session?.user) throw redirect(302, "/");
		const characterId = event.params.characterId;
		try {
			const data = await event.request.formData();
			const parsedData = await parseFormData(data, newCharacterSchema);
			const result = await saveCharacter(characterId, session.user.id, parsedData);
			if (result && result.id) throw redirect(302, `/characters/${result.id}`);
			return result;
		} catch (error) {
			if (error instanceof Error) return { id: characterId, error: error.message };
			throw error;
		}
	}
};
