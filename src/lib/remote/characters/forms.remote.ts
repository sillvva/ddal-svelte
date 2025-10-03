import { BLANK_CHARACTER } from "$lib/constants";
import { characterIdParamSchema, editCharacterSchema, type EditCharacterSchemaIn } from "$lib/schemas";
import { saveForm, validateForm } from "$lib/server/effect/forms";
import { guardedCommand, guardedQuery } from "$lib/server/effect/remote";
import { CharacterService } from "$lib/server/effect/services/characters";
import { Effect } from "effect";
import { get } from "./queries.remote";

export const edit = guardedQuery(characterIdParamSchema, function* (input, { event }) {
	const firstLog = event.locals.app.characters.firstLog;
	const character = yield* Effect.promise(() => get({ param: input }));

	const form = yield* validateForm(
		{
			id: character.id,
			name: character.name,
			campaign: character.campaign || "",
			race: character.race || "",
			class: character.class || "",
			characterSheetUrl: character.characterSheetUrl || "",
			imageUrl: character.imageUrl === BLANK_CHARACTER ? "" : character.imageUrl,
			firstLog: firstLog && input === "new"
		},
		editCharacterSchema,
		{
			errors: input !== "new"
		}
	);

	return {
		form
	};
});

export const save = guardedCommand(function* (input: EditCharacterSchemaIn, { user }) {
	const Characters = yield* CharacterService;

	const form = yield* validateForm(input, editCharacterSchema);
	if (!form.valid) return form;
	const { firstLog, ...data } = form.data;

	const existing = yield* Characters.get
		.all(user.id, { characterId: data.id })
		.pipe(Effect.map((characters) => characters.length > 0));

	return yield* saveForm(Characters.set.save(data, user.id), {
		onSuccess: async (character) => {
			if (firstLog && !existing) {
				return `/characters/${character.id}/log/new?firstLog=true` as const;
			} else {
				return `/characters/${character.id}` as const;
			}
		},
		onError: (err) => {
			err.toForm(form);
			return form;
		}
	});
});
