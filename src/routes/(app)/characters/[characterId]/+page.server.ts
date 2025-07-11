import { characterIdSchema, logIdSchema } from "$lib/schemas.js";
import { assertUser } from "$server/auth";
import { save } from "$server/effect";
import { withCharacter } from "$server/effect/characters";
import { withLog } from "$server/effect/logs.js";
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

		return await save(
			withCharacter((service) => service.deleteCharacter(form.data.id, user.id)),
			{
				onError: (err) => {
					setError(form, "", err.message);
					return fail(err.status, { form });
				},
				onSuccess: () => "/characters"
			}
		);
	},
	deleteLog: async (event) => {
		const user = event.locals.user;
		assertUser(user);

		const form = await superValidate(event, valibot(object({ id: logIdSchema })));
		if (!form.valid) return fail(400, { form });

		return await save(
			withLog((service) => service.deleteLog(form.data.id, user.id)),
			{
				onError: (err) => {
					setError(form, "", err.message);
					return fail(err.status, { form });
				},
				onSuccess: () => ({ form })
			}
		);
	}
};
