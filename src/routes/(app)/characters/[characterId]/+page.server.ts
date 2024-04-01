import { editCharacterSchema, logSchema } from "$lib/schemas.js";
import { deleteCharacter } from "$server/actions/characters";
import { deleteLog } from "$server/actions/logs";
import { error, redirect } from "@sveltejs/kit";
import { fail, setError, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { pick } from "valibot";

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

		const form = await superValidate(event, valibot(pick(editCharacterSchema, ["id"])));
		if (!form.valid) return fail(400, { form });

		const result = await deleteCharacter(form.data.id, session.user.id);
		if ("error" in result) {
			setError(form, "id", result.error);
			return fail(result.status, { form });
		}

		return { form };
	},
	deleteLog: async (event) => {
		const session = await event.locals.session;
		if (!session?.user) redirect(302, "/");

		const form = await superValidate(event, valibot(pick(logSchema, ["id"])));
		if (!form.valid) return fail(400, { form });

		const result = await deleteLog(form.data.id, session.user.id);
		if ("error" in result) {
			setError(form, "id", result.error);
			return fail(result.status, { form });
		}

		return { form };
	}
};
