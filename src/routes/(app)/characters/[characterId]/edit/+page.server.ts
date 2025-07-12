import { BLANK_CHARACTER } from "$lib/constants.js";
import { defaultLogSchema } from "$lib/entities.js";
import { characterIdSchema, editCharacterSchema } from "$lib/schemas";
import { assertUser } from "$server/auth";
import { runOrThrow, save, validateForm } from "$server/effect";
import { withCharacter } from "$server/effect/characters";
import { withLog } from "$server/effect/logs.js";
import { error } from "@sveltejs/kit";
import { Effect } from "effect";
import { fail, setError } from "sveltekit-superforms";
import { parse } from "valibot";

export const load = (event) =>
	runOrThrow(
		Effect.gen(function* () {
			const user = event.locals.user;
			assertUser(user);

			const parent = yield* Effect.promise(() => event.parent());

			let title = "New Character";
			if (event.params.characterId !== "new") {
				title = "Edit";
				parent.breadcrumbs = parent.breadcrumbs.concat({
					name: title,
					href: `/characters/${event.params.characterId}`
				});

				if (!parent.character) error(404, "Character not found");
			}

			const form = yield* validateForm(
				parent.character
					? {
							id: event.params.characterId !== "new" ? parent.character.id : "",
							name: parent.character.name,
							campaign: parent.character.campaign || "",
							race: parent.character.race || "",
							class: parent.character.class || "",
							characterSheetUrl: parent.character.characterSheetUrl || "",
							imageUrl: parent.character.imageUrl.replace(BLANK_CHARACTER, "")
						}
					: {
							firstLog: parent.app.characters.firstLog
						},
				editCharacterSchema,
				{
					errors: false
				}
			);

			return {
				title,
				breadcrumbs: parent.breadcrumbs,
				...event.params,
				form,
				BLANK_CHARACTER
			};
		})
	);

export const actions = {
	saveCharacter: (event) =>
		runOrThrow(
			Effect.gen(function* () {
				const user = event.locals.user;
				assertUser(user);

				const form = yield* validateForm(event, editCharacterSchema);
				if (!form.valid) return fail(400, { form });
				const { firstLog, ...data } = form.data;

				const characterId = parse(characterIdSchema, event.params.characterId);

				return save(
					withCharacter((service) => service.saveCharacter(characterId, user.id, data)),
					{
						onError: (err) => err.toForm(form),
						onSuccess: async (character) => {
							if (firstLog && event.params.characterId === "new") {
								const log = defaultLogSchema(user.id, character);
								log.name = "Character Creation";

								return await save(
									withLog((service) => service.saveLog(log, user)),
									{
										onError: (err) => {
											setError(form, "", err.message);
											return fail(err.status, { form });
										},
										onSuccess: (logResult) => `/characters/${character.id}/log/${logResult.id}?firstLog=true`
									}
								);
							}

							return `/characters/${character.id}`;
						}
					}
				);
			})
		)
};
