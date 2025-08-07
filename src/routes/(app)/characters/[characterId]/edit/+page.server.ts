import { BLANK_CHARACTER } from "$lib/constants.js";
import { editCharacterSchema } from "$lib/schemas";
import { assertAuthOrRedirect } from "$lib/server/auth";
import { runOrThrow, validateForm } from "$lib/server/effect";
import { Effect } from "effect";

export const load = (event) =>
	runOrThrow(function* () {
		yield* assertAuthOrRedirect();

		const parent = yield* Effect.promise(event.parent);

		const form = yield* validateForm(
			{
				id: parent.character.id,
				name: parent.character.name,
				campaign: parent.character.campaign || "",
				race: parent.character.race || "",
				class: parent.character.class || "",
				characterSheetUrl: parent.character.characterSheetUrl || "",
				imageUrl: parent.character.imageUrl === BLANK_CHARACTER ? "" : parent.character.imageUrl,
				firstLog: parent.app.characters.firstLog && parent.character.id === "new"
			},
			editCharacterSchema,
			{
				errors: false
			}
		);

		return {
			...event.params,
			form
		};
	});
