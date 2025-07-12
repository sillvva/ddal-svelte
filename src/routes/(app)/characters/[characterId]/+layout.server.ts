import { characterIdSchema } from "$lib/schemas.js";
import { run } from "$server/effect";
import { withCharacter } from "$server/effect/characters";
import { Effect } from "effect";
import { parse } from "valibot";

export const load = (event) =>
	run(function* () {
		const parent = yield* Effect.promise(() => event.parent());
		const characterId = parse(characterIdSchema, event.params.characterId);

		const character = yield* withCharacter((service) => service.getCharacter(characterId));

		return {
			breadcrumbs: parent.breadcrumbs.concat({
				name: character?.name || "New Character",
				href: `/characters/${character?.id || "new"}`
			}),
			character
		};
	});
