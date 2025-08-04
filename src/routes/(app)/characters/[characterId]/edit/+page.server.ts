import { BLANK_CHARACTER } from "$lib/constants.js";
import { defaultLogSchema } from "$lib/entities.js";
import { characterIdOrNewSchema, editCharacterSchema, type EditCharacterSchema } from "$lib/schemas";
import { assertAuth } from "$lib/server/auth";
import { run, save, validateForm } from "$lib/server/effect";
import { SaveCharacterError, withCharacter } from "$lib/server/effect/characters";
import { withLog } from "$lib/server/effect/logs.js";
import { Effect } from "effect";
import { fail, setError } from "sveltekit-superforms";
import * as v from "valibot";

export const load = (event) =>
	run(function* () {
		yield* assertAuth();

		const parent = yield* Effect.promise(event.parent);

		const form = yield* validateForm(
			{
				id: parent.character.id,
				name: parent.character.name,
				campaign: parent.character.campaign || "",
				race: parent.character.race || "",
				class: parent.character.class || "",
				characterSheetUrl: parent.character.characterSheetUrl || "",
				imageUrl: parent.character.imageUrl === BLANK_CHARACTER ? "" : parent.character.imageUrl,
				firstLog: parent.app.characters.firstLog && parent.character.id === "new"
			},
			editCharacterSchema,
			{
				errors: false
			}
		);

		return {
			...event.params,
			form
		};
	});

export const actions = {
	saveCharacter: (event) =>
		run(function* () {
			const user = yield* assertAuth();

			const form = yield* validateForm(event, editCharacterSchema);
			if (!form.valid) return fail(400, { form });
			const { firstLog, ...data } = form.data;

			const characterId = v.parse(characterIdOrNewSchema, event.params.characterId);

			return save(
				withCharacter((service) => service.set.save(characterId, user.id, data)),
				{
					onError: (err) => err.toForm(form),
					onSuccess: async (character) => {
						if (firstLog && characterId === "new") {
							const log = defaultLogSchema(user.id, character);
							log.name = "Character Creation";

							return await save(
								withLog((service) => service.set.save(log, user)).pipe(
									Effect.catchAll(SaveCharacterError.from<EditCharacterSchema>)
								),
								{
									onError: (err) => {
										setError(form, "", err.message);
										return fail(err.status, { form });
									},
									onSuccess: (logResult) => `/characters/${character.id}/log/${logResult.id}?firstLog=true`
								}
							);
						}

						return `/characters/${character.id}`;
					}
				}
			);
		})
};
