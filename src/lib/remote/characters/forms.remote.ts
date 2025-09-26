import { defaultLogSchema } from "$lib/entities";
import { editCharacterSchema, type EditCharacterSchemaIn } from "$lib/schemas";
import { FormError } from "$lib/server/effect/errors";
import { saveForm, validateForm } from "$lib/server/effect/forms";
import { guardedCommand } from "$lib/server/effect/remote";
import { runSafe } from "$lib/server/effect/runtime";
import { CharacterService } from "$lib/server/effect/services/characters";
import { LogService } from "$lib/server/effect/services/logs";
import { Effect } from "effect";

export const save = guardedCommand(function* (input: EditCharacterSchemaIn, { user }) {
	const Characters = yield* CharacterService;

	const form = yield* validateForm(input, editCharacterSchema);
	if (!form.valid) return form;
	const { firstLog, ...data } = form.data;

	const isNew = yield* Characters.get.character(data.id, false).pipe(
		Effect.map(() => false),
		Effect.catchTag("CharacterNotFoundError", () => Effect.succeed(true)),
		Effect.catchAll(() => Effect.succeed(false))
	);

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
});
