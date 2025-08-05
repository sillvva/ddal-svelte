import { command } from "$app/server";
import { defaultLogSchema } from "$lib/entities";
import { characterIdOrNewSchema, editCharacterSchema, type EditCharacterSchema, type EditCharacterSchemaIn } from "$lib/schemas";
import { assertAuthOrFail } from "$lib/server/auth";
import { runOrThrow, save, validateForm } from "$lib/server/effect";
import { SaveCharacterError, withCharacter } from "$lib/server/effect/characters";
import { withLog } from "$lib/server/effect/logs";
import { Effect } from "effect";
import { setError } from "sveltekit-superforms";
import * as v from "valibot";

export const saveCharacter = command("unchecked", (input: EditCharacterSchemaIn) =>
	runOrThrow(function* () {
		const user = yield* assertAuthOrFail();

		const form = yield* validateForm(input, editCharacterSchema);
		if (!form.valid) return form;
		const { firstLog, ...data } = form.data;

		const characterId = v.parse(characterIdOrNewSchema, input.id);

		return yield* save(
			withCharacter((service) => service.set.save(characterId, user.id, data)),
			{
				onError: (err) => {
					err.toForm(form);
					return form;
				},
				onSuccess: (character) =>
					runOrThrow(function* () {
						if (firstLog && characterId === "new") {
							const log = defaultLogSchema(user.id, character);
							log.name = "Character Creation";

							return yield* save(
								withLog((service) => service.set.save(log, user)).pipe(
									Effect.catchAll(SaveCharacterError.from<EditCharacterSchema>)
								),
								{
									onError: (err) => {
										setError(form, "", err.message);
										return form;
									},
									onSuccess: (logResult) => `/characters/${character.id}/log/${logResult.id}?firstLog=true` as const
								}
							);
						}

						return `/characters/${character.id}` as const;
					})
			}
		);
	})
);
