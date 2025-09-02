import { command } from "$app/server";
import { defaultLogSchema } from "$lib/entities";
import { editCharacterSchema, type CharacterIdParam, type EditCharacterSchemaIn } from "$lib/schemas";
import { FormError, RedirectError } from "$lib/server/effect/errors";
import { saveForm, validateForm } from "$lib/server/effect/forms";
import { runAuthSafe, runSafe } from "$lib/server/effect/runtime";
import { CharacterService } from "$lib/server/effect/services/characters";
import { LogService } from "$lib/server/effect/services/logs";

export const save = command("unchecked", (input: { id: CharacterIdParam; data: EditCharacterSchemaIn }) =>
	runAuthSafe(function* (user) {
		const Characters = yield* CharacterService;

		const characterId = input.id;
		const character = characterId !== "new" ? yield* Characters.get.character(characterId, false) : undefined;
		if (characterId !== "new" && !character) return yield* new RedirectError("Character not found", "/characters", 302);

		const form = yield* validateForm(input.data, editCharacterSchema);
		if (!form.valid) return form;
		const { firstLog, ...data } = form.data;

		return yield* saveForm(Characters.set.save(data, user.id), {
			onError: (err) => {
				err.toForm(form);
				return form;
			},
			onSuccess: async (character) => {
				const result = await runSafe(function* () {
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
