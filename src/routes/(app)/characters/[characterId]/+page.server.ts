import { characterIdSchema, logIdSchema } from "$lib/schemas.js";
import { SaveError } from "$lib/util.js";
import { deleteCharacter } from "$server/actions/characters";
import { deleteLog } from "$server/actions/logs";
import { assertUser } from "$server/auth.js";
import { error, redirect } from "@sveltejs/kit";
import { fail, setError, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { object } from "valibot";

export const load = async (event) => {
	if (event.params.characterId === "new") redirect(301, "/characters/new/edit");

	const parent = await event.parent();
	const character = parent.character;
	if (!character) error(404, "Character not found");

	return {
		title: character.name,
		description: `Level ${character.totalLevel} ${character.race} ${character.class}`.replace(/ {2,}/g, " ").trim(),
		image: character.imageUrl,
		character
	};
};

export const actions = {
	deleteCharacter: async (event) => {
		const session = await event.locals.session;
		assertUser(session?.user, event.url);

		const form = await superValidate(event, valibot(object({ id: characterIdSchema })));
		if (!form.valid) return fail(400, { form });

		const result = await deleteCharacter(form.data.id, session.user.id);
		if (result instanceof SaveError) {
			setError(form, "", result.error);
			return fail(result.status, { form });
		}

		redirect(302, "/characters");
	},
	deleteLog: async (event) => {
		const session = await event.locals.session;
		assertUser(session?.user, event.url);

		const form = await superValidate(event, valibot(object({ id: logIdSchema })));
		if (!form.valid) return fail(400, { form });

		const result = await deleteLog(form.data.id, session.user.id);
		if (result instanceof SaveError) {
			setError(form, "", result.error);
			return fail(result.status, { form });
		}

		return { form };
	}
};
