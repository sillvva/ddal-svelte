import { command } from "$app/server";
import { defaultLogSchema } from "$lib/entities";
import { characterIdOrNewSchema, editCharacterSchema, parse, type EditCharacterSchemaIn } from "$lib/schemas";
import { FormError, saveForm, validateForm } from "$lib/server/effect/forms";
import { authReturn, runOrReturn } from "$lib/server/effect/runtime";
import { CharacterService } from "$lib/server/effect/services/characters";
import { LogService } from "$lib/server/effect/services/logs";

export default {
	save: command("unchecked", (input: EditCharacterSchemaIn) =>
		authReturn(function* (user) {
			const Characters = yield* CharacterService;

			const form = yield* validateForm(input, editCharacterSchema);
			if (!form.valid) return form;
			const { firstLog, ...data } = form.data;

			const characterId = yield* parse(characterIdOrNewSchema, input.id);

			return yield* saveForm(Characters.set.save(characterId, user.id, data), {
				onError: (err) => {
					err.toForm(form);
					return form;
				},
				onSuccess: async (character) => {
					const result = await runOrReturn(function* () {
						const Logs = yield* LogService;

						if (firstLog && characterId === "new") {
							const log = defaultLogSchema(user.id, { character, defaults: { name: "Character Creation" } });

							return yield* saveForm(Logs.set.save(log, user), {
								onError: () => `/characters/${character.id}/log/new?firstLog=true` as const,
								onSuccess: (logResult) => `/characters/${character.id}/log/${logResult.id}?firstLog=true` as const
							});
						}

						return `/characters/${character.id}` as const;
					});

					if (result.ok) {
						return result.data;
					}

					FormError.from(result.error).toForm(form);
					return form;
				}
			});
		})
	)
};
