import { characterIdSchema, logIdSchema } from "$lib/schemas.js";
import { assertUser } from "$server/auth";
import { runOrThrow, save, validateForm } from "$server/effect";
import { withCharacter } from "$server/effect/characters";
import { withLog } from "$server/effect/logs.js";
import { error, redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import { fail, setError } from "sveltekit-superforms";
import { object } from "valibot";

export const load = (event) =>
	runOrThrow(
		Effect.gen(function* () {
			if (event.params.characterId === "new") redirect(301, "/characters/new/edit");

			const parent = yield* Effect.promise(() => event.parent());
			const character = parent.character;
			if (!character) error(404, "Character not found");

			return {
				title: character.name,
				description: `Level ${character.totalLevel} ${character.race} ${character.class}`.replace(/ {2,}/g, " ").trim(),
				image: character.imageUrl,
				character
			};
		})
	);

export const actions = {
	deleteCharacter: (event) =>
		runOrThrow(
			Effect.gen(function* () {
				const user = event.locals.user;
				assertUser(user);

				const form = yield* validateForm(event, object({ id: characterIdSchema }));
				if (!form.valid) return fail(400, { form });

				return save(
					withCharacter((service) => service.deleteCharacter(form.data.id, user.id)),
					{
						onError: (err) => {
							setError(form, "", err.message);
							return fail(err.status, { form });
						},
						onSuccess: () => "/characters"
					}
				);
			})
		),
	deleteLog: (event) =>
		runOrThrow(
			Effect.gen(function* () {
				const user = event.locals.user;
				assertUser(user);

				const form = yield* validateForm(event, object({ id: logIdSchema }));
				if (!form.valid) return fail(400, { form });

				return save(
					withLog((service) => service.deleteLog(form.data.id, user.id)),
					{
						onError: (err) => {
							setError(form, "", err.message);
							return fail(err.status, { form });
						},
						onSuccess: () => ({ form })
					}
				);
			})
		)
};
