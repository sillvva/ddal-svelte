import { characterIdSchema } from "$lib/schemas.js";
import { run } from "$server/effect";
import { withCharacter } from "$server/effect/characters";
import { redirect } from "@sveltejs/kit";
import * as v from "valibot";

export const load = (event) =>
	run(function* () {
		const result = v.safeParse(characterIdSchema, event.params.characterId);
		if (!result.success) throw redirect(302, "/characters?uuid=1");
		const characterId = result.output;

		const character = characterId === "new" ? undefined : yield* withCharacter((service) => service.get.character(characterId));

		return {
			character
		};
	});
