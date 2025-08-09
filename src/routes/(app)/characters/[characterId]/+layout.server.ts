import { parseCharacter } from "$lib/entities.js";
import { characterIdOrNewSchema, type CharacterId } from "$lib/schemas.js";
import { runOrThrow } from "$lib/server/effect";
import { withCharacter } from "$lib/server/effect/characters";
import { redirect } from "@sveltejs/kit";
import * as v from "valibot";

export const load = (event) =>
	runOrThrow(function* () {
		const result = v.safeParse(characterIdOrNewSchema, event.params.characterId);
		if (!result.success) throw redirect(307, `/characters${event.params.characterId !== "new" ? "?uuid=1" : ""}`);
		const characterId = result.output;

		if (event.params.characterId === "new" && event.url.pathname !== "/characters/new/edit")
			throw redirect(307, "/characters/new/edit");

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
					: redirect(307, "/")
				: yield* withCharacter((service) => service.get.character(characterId));

		return {
			character
		};
	});
