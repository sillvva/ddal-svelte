import { getRequestEvent } from "$app/server";
import { BLANK_CHARACTER } from "$lib/constants";
import { defaultCharacter } from "$lib/entities";
import { characterIdParamSchema, editCharacterSchema } from "$lib/schemas";
import { RedirectError } from "$lib/server/effect/errors";
import { validateForm } from "$lib/server/effect/forms";
import { guardedQuery } from "$lib/server/effect/remote";
import { CharacterService } from "$lib/server/effect/services/characters";
import { Effect } from "effect";
import * as v from "valibot";

export const getCharacters = guardedQuery(function* ({ user }) {
	const Characters = yield* CharacterService;
	const characters = yield* Characters.get.userCharacters(user.id);
	return characters;
});

export const getCharacter = guardedQuery(
	v.object({
		param: characterIdParamSchema,
		editRedirect: v.optional(v.boolean(), false)
	}),
	function* (input) {
		const Character = yield* CharacterService;
		const event = getRequestEvent();

		if (input.param === "new" && input.editRedirect)
			return yield* new RedirectError({ message: "Redirecting to new character form", redirectTo: "/characters/new/edit" });

		const character =
			input.param === "new"
				? event.locals.user
					? defaultCharacter(event.locals.user)
					: yield* new RedirectError({ message: "Redirecting to login", redirectTo: "/" })
				: yield* Character.get.character(input.param);

		return character;
	}
);

export const getCharacterForm = guardedQuery(
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
