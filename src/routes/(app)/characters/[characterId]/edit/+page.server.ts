import { BLANK_CHARACTER } from "$lib/constants.js";
import { defaultLogSchema } from "$lib/entities.js";
import { characterIdSchema, editCharacterSchema } from "$lib/schemas";
import { SaveError } from "$lib/util.js";
import { saveCharacter } from "$server/actions/characters.js";
import { saveLog } from "$server/actions/logs.js";
import { assertUser } from "$server/auth";
import { error, redirect } from "@sveltejs/kit";
import { fail, setError, superValidate } from "sveltekit-superforms";
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

		if (!parent.character) error(404, "Character not found");
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
		valibot(editCharacterSchema),
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

		const form = await superValidate(event, valibot(editCharacterSchema));
		if (!form.valid) return fail(400, { form });
		const { firstLog, ...data } = form.data;

		const characterId = parse(characterIdSchema, event.params.characterId);
		const result = await saveCharacter(characterId, session.user.id, data);
		if (result instanceof SaveError) return result.toForm(form);

		if (firstLog && event.params.characterId === "new") {
			const logResult = await saveLog(
				{
					...defaultLogSchema(session.user.id, result),
					name: "Character Creation"
				},
				session.user
			);

			if (logResult instanceof SaveError) {
				setError(form, "", logResult.error);
				return fail(logResult.status, { form });
			}

			redirect(302, `/characters/${result.id}/log/${logResult.id}?firstLog=true`);
		}

		redirect(302, `/characters/${result.id}`);
	}
};
