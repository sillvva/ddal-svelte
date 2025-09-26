import { defaultCharacter } from "$lib/entities";
import { characterIdParamSchema } from "$lib/schemas";
import { RedirectError } from "$lib/server/effect/errors";
import { guardedQuery } from "$lib/server/effect/remote";
import { CharacterService } from "$lib/server/effect/services/characters";
import * as v from "valibot";

export const getCharacters = guardedQuery(function* ({ user }) {
	const Characters = yield* CharacterService;
	return yield* Characters.get.userCharacters(user.id);
});

export const getCharacter = guardedQuery(
	v.object({
		param: characterIdParamSchema,
		editRedirect: v.optional(v.boolean(), false)
	}),
	function* (input, { user }) {
		const Character = yield* CharacterService;

		if (input.param === "new" && input.editRedirect)
			return yield* new RedirectError({ message: "Redirecting to new character form", redirectTo: "/characters/new/edit" });

		const character =
			input.param === "new"
				? user
					? defaultCharacter(user)
					: yield* new RedirectError({ message: "Redirecting to login", redirectTo: "/" })
				: yield* Character.get.character(input.param);

		return character;
	}
);
