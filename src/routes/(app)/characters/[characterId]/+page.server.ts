import { run } from "$lib/server/effect";
import { CharacterNotFoundError } from "$lib/server/effect/characters";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";

export const load = (event) =>
	run(function* () {
		if (event.params.characterId === "new") redirect(301, "/characters/new/edit");

		const parent = yield* Effect.promise(event.parent);
		const character = parent.character;
		if (!character) return yield* new CharacterNotFoundError();

		return {
			character
		};
	});
