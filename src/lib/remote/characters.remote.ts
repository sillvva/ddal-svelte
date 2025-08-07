import { command } from "$app/server";
import { defaultLogSchema } from "$lib/entities";
import { placeholderQuery } from "$lib/remote/command.remote";
import { characterIdOrNewSchema, characterIdSchema, editCharacterSchema, type EditCharacterSchemaIn } from "$lib/schemas";
import { assertAuthOrFail } from "$lib/server/auth";
import { FormError, runOrReturn, save, validateForm } from "$lib/server/effect";
import { withCharacter } from "$lib/server/effect/characters";
import { withLog } from "$lib/server/effect/logs";
import * as v from "valibot";

export const saveCharacter = command("unchecked", (input: EditCharacterSchemaIn) =>
	runOrReturn(function* () {
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
				onSuccess: async (character) => {
					const result = await runOrReturn(function* () {
						if (firstLog && characterId === "new") {
							const log = defaultLogSchema(user.id, { character, defaults: { name: "Character Creation" } });

							return yield* save(
								withLog((service) => service.set.save(log, user)),
								{
									onError: () => `/characters/${character.id}/log/new?firstLog=true` as const,
									onSuccess: (logResult) => `/characters/${character.id}/log/${logResult.id}?firstLog=true` as const
								}
							);
						}

						return `/characters/${character.id}` as const;
					});

					if (result.ok) {
						return result.data;
					}

					FormError.from(result.error).toForm(form);
					return form;
				}
			}
		);
	})
);

export const deleteCharacter = command(characterIdSchema, (id) =>
	runOrReturn(function* () {
		const user = yield* assertAuthOrFail();
		placeholderQuery().refresh();
		return yield* withCharacter((service) => service.set.delete(id, user.id));
	})
);
