import { characterIdSchema, logIdSchema } from "$lib/schemas.js";
import { assertUser } from "$server/auth";
import { run, save, validateForm } from "$server/effect";
import { FetchCharacterError, withCharacter } from "$server/effect/characters";
import { withLog } from "$server/effect/logs.js";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import { fail, setError } from "sveltekit-superforms";
import { object } from "valibot";

export const load = (event) =>
	run(function* () {
		if (event.params.characterId === "new") redirect(301, "/characters/new/edit");

		const parent = yield* Effect.promise(() => event.parent());
		const character = parent.character;
		if (!character) return yield* new FetchCharacterError("Character not found", 404);

		return {
			title: character.name,
			description: `Level ${character.totalLevel} ${character.race} ${character.class}`.replace(/ {2,}/g, " ").trim(),
			image: character.imageUrl,
			character
		};
	});

export const actions = {
	deleteCharacter: (event) =>
		run(function* () {
			const user = event.locals.user;
			assertUser(user);

			const form = yield* validateForm(event, object({ id: characterIdSchema }));
			if (!form.valid) return fail(400, { form });

			return save(
				withCharacter((service) => service.set.delete(form.data.id, user.id)),
				{
					onError: (err) => {
						setError(form, "", err.message);
						return fail(err.status, { form });
					},
					onSuccess: () => "/characters"
				}
			);
		}),
	deleteLog: (event) =>
		run(function* () {
			const user = event.locals.user;
			assertUser(user);

			const form = yield* validateForm(event, object({ id: logIdSchema }));
			if (!form.valid) return fail(400, { form });

			return save(
				withLog((service) => service.set.delete(form.data.id, user.id)),
				{
					onError: (err) => {
						setError(form, "", err.message);
						return fail(err.status, { form });
					},
					onSuccess: () => ({ form })
				}
			);
		})
};
