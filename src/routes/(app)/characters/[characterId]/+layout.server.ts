import { parseCharacter } from "$lib/entities.js";
import { characterIdOrNewSchema, type CharacterId } from "$lib/schemas.js";
import { RedirectError } from "$lib/server/effect/errors.js";
import { parse } from "$lib/server/effect/forms.js";
import { run } from "$lib/server/effect/runtime.js";
import { CharacterService } from "$lib/server/effect/services/characters";

export const load = (event) =>
	run(function* () {
		const Character = yield* CharacterService;

		const characterId = yield* parse(characterIdOrNewSchema, event.params.characterId, "/characters?uuid=1", 301);

		if (event.params.characterId === "new" && event.url.pathname !== "/characters/new/edit")
			return yield* new RedirectError("Redirecting to new character form", "/characters/new/edit", 302);

		const character =
			characterId === "new"
				? event.locals.user
					? parseCharacter({
							id: "new" as CharacterId,
							name: "",
							race: "",
							class: "",
							campaign: "",
							imageUrl: "",
							characterSheetUrl: "",
							userId: event.locals.user.id,
							user: event.locals.user,
							createdAt: new Date(),
							logs: []
						})
					: yield* new RedirectError("Redirecting to login", "/", 302)
				: yield* Character.get.character(characterId);

		return {
			character
		};
	});
