import { characterIdSchema, logIdSchema } from "$lib/schemas.js";
import { assertAuth } from "$server/auth";
import { run, save, validateForm } from "$server/effect";
import { CharacterNotFoundError, withCharacter } from "$server/effect/characters";
import { withLog } from "$server/effect/logs.js";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import { fail, setError } from "sveltekit-superforms";
import * as v from "valibot";

export const load = (event) =>
	run(function* () {
		if (event.params.characterId === "new") redirect(301, "/characters/new/edit");

		const parent = yield* Effect.promise(event.parent);
		const character = parent.character;
		if (!character) return yield* new CharacterNotFoundError();

		return {
			character
		};
	});

export const actions = {
	deleteCharacter: (event) =>
		run(function* () {
			const user = yield* assertAuth();

			const form = yield* validateForm(event, v.object({ id: characterIdSchema }));
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
			const user = yield* assertAuth();

			const form = yield* validateForm(event, v.object({ id: logIdSchema }));
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
