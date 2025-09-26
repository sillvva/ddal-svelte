import { BLANK_CHARACTER } from "$lib/constants";
import { defaultLogSchema } from "$lib/entities";
import { characterIdParamSchema, editCharacterSchema, type EditCharacterSchemaIn } from "$lib/schemas";
import { FormError } from "$lib/server/effect/errors";
import { saveForm, validateForm } from "$lib/server/effect/forms";
import { guardedCommand, guardedQuery } from "$lib/server/effect/remote";
import { runSafe } from "$lib/server/effect/runtime";
import { CharacterService } from "$lib/server/effect/services/characters";
import { LogService } from "$lib/server/effect/services/logs";
import { Effect } from "effect";
import * as v from "valibot";
import { getCharacter } from "./queries.remote";

export const edit = guardedQuery(
	v.object({
		param: characterIdParamSchema,
		editing: v.optional(v.boolean(), false)
	}),
	function* (input, { event }) {
		const firstLog = event.locals.app.characters.firstLog;
		const character = yield* Effect.promise(() => getCharacter(input));

		const form = yield* validateForm(
			{
				id: character.id,
				name: character.name,
				campaign: character.campaign || "",
				race: character.race || "",
				class: character.class || "",
				characterSheetUrl: character.characterSheetUrl || "",
				imageUrl: character.imageUrl === BLANK_CHARACTER ? "" : character.imageUrl,
				firstLog: firstLog && input.param === "new"
			},
			editCharacterSchema,
			{
				errors: input.param !== "new"
			}
		);

		return {
			form
		};
	}
);

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
