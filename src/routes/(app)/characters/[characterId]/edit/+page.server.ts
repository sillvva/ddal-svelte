import { BLANK_CHARACTER } from "$lib/constants.js";
import { newCharacterSchema } from "$lib/schemas";
import { saveCharacter } from "$src/server/actions/characters.js";
import { signInRedirect } from "$src/server/auth";
import { error, fail, redirect } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";

export const load = async (event) => {
	const parent = await event.parent();

	const session = event.locals.session;
	if (!session?.user) signInRedirect(event.url);

	let title = "New Character";
	if (event.params.characterId !== "new") {
		if (!parent.character) error(404, "Character not found");
		title = "Edit";
		parent.breadcrumbs = parent.breadcrumbs.concat({
			name: title,
			href: `/characters/${event.params.characterId}`
		});
	}

	const form = await superValidate(valibot(newCharacterSchema), {
		defaults: parent.character
			? {
					name: parent.character.name,
					campaign: parent.character.campaign || "",
					race: parent.character.race || "",
					class: parent.character.class || "",
					character_sheet_url: parent.character.character_sheet_url || "",
					image_url: parent.character.image_url.replace(BLANK_CHARACTER, "")
				}
			: undefined
	});

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
		if (!session?.user) redirect(302, "/");

		const form = await superValidate(event, valibot(newCharacterSchema));
		if (!form.valid) return fail(400, { form });

		const characterId = event.params.characterId;
		const result = await saveCharacter(characterId, session.user.id, form.data);
		if ("id" in result) redirect(302, `/characters/${result.id}`);

		event.cookies.set("clearCache", "true", { path: "/" });

		return message(
			form,
			{
				type: "error",
				text: result.error
			},
			{
				status: result.status
			}
		);
	}
};
