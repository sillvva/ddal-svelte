import { BLANK_CHARACTER } from "$lib/constants.js";
import { defaultLogSchema } from "$lib/entities.js";
import { characterIdSchema, editCharacterSchema } from "$lib/schemas";
import { assertUser } from "$server/auth";
import { run, save, validateForm } from "$server/effect";
import { FetchCharacterError, withCharacter } from "$server/effect/characters";
import { withLog } from "$server/effect/logs.js";
import { Effect } from "effect";
import { fail, setError } from "sveltekit-superforms";
import { parse } from "valibot";

export const load = (event) =>
	run(function* () {
		const user = event.locals.user;
		assertUser(user);

		const parent = yield* Effect.promise(event.parent);

		let title = "New Character";
		if (event.params.characterId !== "new") {
			title = "Edit";
			parent.breadcrumbs = parent.breadcrumbs.concat({
				name: title,
				href: `/characters/${event.params.characterId}`
			});

			if (!parent.character) return yield* new FetchCharacterError("Character not found", 404);
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
	});

export const actions = {
	saveCharacter: (event) =>
		run(function* () {
			const user = event.locals.user;
			assertUser(user);

			const form = yield* validateForm(event, editCharacterSchema);
			if (!form.valid) return fail(400, { form });
			const { firstLog, ...data } = form.data;

			const characterId = parse(characterIdSchema, event.params.characterId);

			return save(
				withCharacter((service) => service.set.save(characterId, user.id, data)),
				{
					onError: (err) => err.toForm(form),
					onSuccess: async (character) => {
						if (firstLog && event.params.characterId === "new") {
							const log = defaultLogSchema(user.id, character);
							log.name = "Character Creation";

							return await save(
								withLog((service) => service.set.save(log, user)),
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
};
