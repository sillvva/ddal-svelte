import { defaultCharacter } from "$lib/entities.js";
import { characterIdSchema } from "$lib/schemas.js";
import { RedirectError } from "$lib/server/effect/errors.js";
import { parse } from "$lib/server/effect/forms.js";
import { run } from "$lib/server/effect/runtime.js";
import { CharacterService } from "$lib/server/effect/services/characters";
import * as v from "valibot";

export const load = (event) =>
	run(function* () {
		const Character = yield* CharacterService;

		const characterId = yield* parse(
			v.union([characterIdSchema, v.literal("new")]),
			event.params.characterId,
			"/characters?uuid=1",
			301
		);

		if (characterId === "new" && event.url.pathname !== "/characters/new/edit")
			return yield* new RedirectError("Redirecting to new character form", "/characters/new/edit", 302);

		const character =
			characterId === "new"
				? event.locals.user
					? defaultCharacter(event.locals.user)
					: yield* new RedirectError("Redirecting to login", "/", 302)
				: yield* Character.get.character(characterId);

		return {
			characterId,
			character
		};
	});
