import { command } from "$app/server";
import { defaultLogSchema } from "$lib/entities";
import { editCharacterSchema, type EditCharacterSchemaIn } from "$lib/schemas";
import { FormError } from "$lib/server/effect/errors";
import { saveForm, validateForm } from "$lib/server/effect/forms";
import { runSafe } from "$lib/server/effect/runtime";
import { assertAuth } from "$lib/server/effect/services/auth";
import { CharacterService } from "$lib/server/effect/services/characters";
import { LogService } from "$lib/server/effect/services/logs";

export const save = command("unchecked", (input: EditCharacterSchemaIn) =>
	runSafe(function* () {
		const { user } = yield* assertAuth();
		const Characters = yield* CharacterService;

		const form = yield* validateForm(input, editCharacterSchema);
		if (!form.valid) return form;
		const { firstLog, ...data } = form.data;

		const isNew = !!Characters.get.character(data.id, false);

		return yield* saveForm(Characters.set.save(data, user.id), {
			onSuccess: async (character) => {
				const result = await runSafe(function* () {
					const Logs = yield* LogService;

					if (firstLog && isNew) {
						const log = defaultLogSchema(user.id, { character, defaults: { name: "Character Creation" } });

						return yield* saveForm(Logs.set.save(log, user), {
							onSuccess: (logResult) => `/characters/${character.id}/log/${logResult.id}?firstLog=true` as const,
							onError: () => `/characters/${character.id}/log/new?firstLog=true` as const
						});
					}

					return `/characters/${character.id}` as const;
				});

				if (result.ok) {
					return result.data;
				}

				FormError.from(result.error).toForm(form);
				return form;
			},
			onError: (err) => {
				err.toForm(form);
				return form;
			}
		});
	})
);
