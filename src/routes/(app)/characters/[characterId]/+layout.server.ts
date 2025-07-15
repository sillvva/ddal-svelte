import { characterIdSchema } from "$lib/schemas.js";
import { run } from "$server/effect";
import { withCharacter } from "$server/effect/characters";
import { parse } from "valibot";

export const load = (event) =>
	run(function* () {
		const characterId = parse(characterIdSchema, event.params.characterId);
		const character = yield* withCharacter((service) => service.get.character(characterId));

		return {
			character
		};
	});
