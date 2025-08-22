import { command } from "$app/server";
import { defaultLogSchema } from "$lib/entities";
import { characterIdOrNewSchema, editCharacterSchema, type EditCharacterSchemaIn } from "$lib/schemas";
import { FormError } from "$lib/server/effect/errors";
import { parse, saveForm, validateForm } from "$lib/server/effect/forms";
import { authReturn, runOrReturn } from "$lib/server/effect/runtime";
import { CharacterService } from "$lib/server/effect/services/characters";
import { LogService } from "$lib/server/effect/services/logs";

export const save = command("unchecked", (input: EditCharacterSchemaIn) =>
	authReturn(function* (user) {
		const Characters = yield* CharacterService;

		const characterId = yield* parse(characterIdOrNewSchema, input.id, "/characters", 404);

		const form = yield* validateForm(input, editCharacterSchema);
		if (!form.valid) return form;
		const { firstLog, ...data } = form.data;

		return yield* saveForm(Characters.set.save(data, user.id), {
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
);
