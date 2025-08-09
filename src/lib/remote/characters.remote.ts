import { command } from "$app/server";
import { defaultLogSchema } from "$lib/entities";
import { placeholderQuery } from "$lib/remote/command.remote";
import { characterIdOrNewSchema, characterIdSchema, editCharacterSchema, type EditCharacterSchemaIn } from "$lib/schemas";
import { FormError, save, validateForm } from "$lib/server/effect";
import { CharacterService } from "$lib/server/effect/characters";
import { LogService } from "$lib/server/effect/logs";
import { authReturn, runOrReturn } from "$lib/server/effect/runtime";
import * as v from "valibot";

export const saveCharacter = command("unchecked", (input: EditCharacterSchemaIn) =>
	authReturn(function* ({ user, runtime }) {
		const Characters = yield* CharacterService;

		const form = yield* validateForm(input, editCharacterSchema);
		if (!form.valid) return form;
		const { firstLog, ...data } = form.data;

		const characterId = v.parse(characterIdOrNewSchema, input.id);

		return yield* save(Characters.set.save(characterId, user.id, data), {
			onError: (err) => {
				err.toForm(form);
				return form;
			},
			onSuccess: async (character) => {
				const result = await runOrReturn(function* () {
					const Logs = yield* LogService;

					if (firstLog && characterId === "new") {
						const log = defaultLogSchema(user.id, { character, defaults: { name: "Character Creation" } });

						return yield* save(Logs.set.save(log, user), {
							onError: () => `/characters/${character.id}/log/new?firstLog=true` as const,
							onSuccess: (logResult) => `/characters/${character.id}/log/${logResult.id}?firstLog=true` as const
						});
					}

					return `/characters/${character.id}` as const;
				}, runtime);

				if (result.ok) {
					return result.data;
				}

				FormError.from(result.error).toForm(form);
				return form;
			}
		});
	})
);

export const deleteCharacter = command(characterIdSchema, (id) =>
	authReturn(function* ({ user }) {
		const Characters = yield* CharacterService;
		placeholderQuery().refresh();
		return yield* Characters.set.delete(id, user.id);
	})
);
