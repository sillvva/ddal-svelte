import { BLANK_CHARACTER } from "$lib/constants.js";
import { defaultLogSchema } from "$lib/entities.js";
import { assertUser, characterIdSchema, editCharacterSchema } from "$lib/schemas";
import { saveCharacter } from "$server/actions/characters.js";
import { saveLog } from "$server/actions/logs.js";
import { save } from "$server/db/effect";
import { error } from "@sveltejs/kit";
import { fail, setError, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { parse } from "valibot";

export const load = async (event) => {
	const user = event.locals.user;
	assertUser(user, event.url);

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
					id: event.params.characterId !== "new" ? parent.character.id : "",
					name: parent.character.name,
					campaign: parent.character.campaign || "",
					race: parent.character.race || "",
					class: parent.character.class || "",
					characterSheetUrl: parent.character.characterSheetUrl || "",
					imageUrl: parent.character.imageUrl.replace(BLANK_CHARACTER, "")
				}
			: {
					firstLog: parent.app.characters.firstLog
				},
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
		const user = event.locals.user;
		assertUser(user, event.url);

		const form = await superValidate(event, valibot(editCharacterSchema));
		if (!form.valid) return fail(400, { form });
		const { firstLog, ...data } = form.data;

		const characterId = parse(characterIdSchema, event.params.characterId);

		return await save(saveCharacter(characterId, user.id, data), {
			onError: (err) => err.toForm(form),
			onSuccess: async (result) => {
				if (firstLog && event.params.characterId === "new") {
					const log = defaultLogSchema(user.id, result);
					log.name = "Character Creation";

					return await save(saveLog(log, user), {
						onError: (err) => {
							setError(form, "", err.message);
							return fail(err.status, { form });
						},
						onSuccess: (logResult) => `/characters/${result.id}/log/${logResult.id}?firstLog=true`
					});
				}

				return `/characters/${result.id}`;
			}
		});
	}
};
