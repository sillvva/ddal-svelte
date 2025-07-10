import { characterIdSchema, logIdSchema } from "$lib/schemas.js";
import { deleteCharacter } from "$server/actions/characters";
import { deleteLog } from "$server/actions/logs";
import { assertUser } from "$server/auth";
import { save } from "$server/db/effect";
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
		const user = event.locals.user;
		assertUser(user);

		const form = await superValidate(event, valibot(object({ id: characterIdSchema })));
		if (!form.valid) return fail(400, { form });

		return await save(deleteCharacter(form.data.id, user.id), {
			onError: (err) => {
				setError(form, "", err.message);
				return fail(err.status, { form });
			},
			onSuccess: () => redirect(302, "/characters")
		});
	},
	deleteLog: async (event) => {
		const user = event.locals.user;
		assertUser(user);

		const form = await superValidate(event, valibot(object({ id: logIdSchema })));
		if (!form.valid) return fail(400, { form });

		return await save(deleteLog(form.data.id, user.id), {
			onError: (err) => {
				setError(form, "", err.message);
				return fail(err.status, { form });
			},
			onSuccess: () => ({ form })
		});
	}
};
