import { defaultCharacter } from "$lib/entities.js";
import { RedirectError } from "$lib/server/effect/errors.js";
import { run } from "$lib/server/effect/runtime.js";
import { CharacterService } from "$lib/server/effect/services/characters";

export const load = (event) =>
	run(function* () {
		const Character = yield* CharacterService;
		const characterId = event.params.characterId;

		if (characterId === "new" && event.url.pathname !== "/characters/new/edit")
			return yield* new RedirectError({ message: "Redirecting to new character form", redirectTo: "/characters/new/edit" });

		const character =
			characterId === "new"
				? event.locals.user
					? defaultCharacter(event.locals.user)
					: yield* new RedirectError({ message: "Redirecting to login", redirectTo: "/" })
				: yield* Character.get.character(characterId);

		return {
			characterId,
			character
		};
	});
