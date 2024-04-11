import { BLANK_CHARACTER } from "$lib/constants.js";
import { characterIdSchema, newCharacterSchema } from "$lib/schemas";
import { saveCharacter } from "$server/actions/characters.js";
import { assertUser } from "$server/auth";
import { redirect } from "@sveltejs/kit";
import { fail, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { parse } from "valibot";

export const load = async (event) => {
	const session = event.locals.session;
	assertUser(session?.user, event.url);

	const parent = await event.parent();

	let title = "New Character";
	if (event.params.characterId !== "new") {
		title = "Edit";
		parent.breadcrumbs = parent.breadcrumbs.concat({
			name: title,
			href: `/characters/${event.params.characterId}`
		});
	}

	const form = await superValidate(
		parent.character
			? {
					name: parent.character.name,
					campaign: parent.character.campaign || "",
					race: parent.character.race || "",
					class: parent.character.class || "",
					characterSheetUrl: parent.character.characterSheetUrl || "",
					imageUrl: parent.character.imageUrl.replace(BLANK_CHARACTER, "")
				}
			: undefined,
		valibot(newCharacterSchema),
		{
			errors: false
		}
	);

	return {
		title,
		breadcrumbs: parent.breadcrumbs,
		...event.params,
		form,
		BLANK_CHARACTER
	};
};

export const actions = {
	saveCharacter: async (event) => {
		const session = await event.locals.session;
		assertUser(session?.user, event.url);

		const form = await superValidate(event, valibot(newCharacterSchema));
		if (!form.valid) return fail(400, { form });

		const characterId = parse(characterIdSchema, event.params.characterId);
		const result = await saveCharacter(characterId, session.user.id, form.data);
		if ("error" in result) return result.toForm(form);

		redirect(302, `/characters/${result.id}`);
	}
};
