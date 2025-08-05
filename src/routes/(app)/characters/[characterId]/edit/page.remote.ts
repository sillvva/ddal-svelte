import { command } from "$app/server";
import { defaultLogSchema } from "$lib/entities";
import { characterIdOrNewSchema, editCharacterSchema, type EditCharacterSchema, type EditCharacterSchemaIn } from "$lib/schemas";
import { assertAuthOrFail } from "$lib/server/auth";
import { run, saveRemote, validateForm } from "$lib/server/effect";
import { SaveCharacterError, withCharacter } from "$lib/server/effect/characters";
import { withLog } from "$lib/server/effect/logs";
import { Effect } from "effect";
import { setError } from "sveltekit-superforms";
import * as v from "valibot";

export const saveCharacter = command("unchecked", (input: EditCharacterSchemaIn) =>
	run(function* () {
		const user = yield* assertAuthOrFail();

		const form = yield* validateForm(input, editCharacterSchema);
		if (!form.valid) return form;
		const { firstLog, ...data } = form.data;

		const characterId = v.parse(characterIdOrNewSchema, input.id);

		return yield* Effect.promise(() =>
			saveRemote(
				withCharacter((service) => service.set.save(characterId, user.id, data)),
				{
					onError: (err) => {
						err.toForm(form);
						return form;
					},
					onSuccess: async (character) => {
						if (firstLog && characterId === "new") {
							const log = defaultLogSchema(user.id, character);
							log.name = "Character Creation";

							return await saveRemote(
								withLog((service) => service.set.save(log, user)).pipe(
									Effect.catchAll(SaveCharacterError.from<EditCharacterSchema>)
								),
								{
									onError: (err) => {
										setError(form, "", err.message);
										return form;
									},
									onSuccess: (logResult) => `/characters/${character.id}/log/${logResult.id}?firstLog=true`
								}
							);
						}

						return `/characters/${character.id}`;
					}
				}
			)
		);
	})
);
