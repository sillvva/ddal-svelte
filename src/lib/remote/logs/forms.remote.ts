import type { Pathname } from "$app/types";
import { characterIdSchema, characterLogSchema, dMLogSchema, type LogSchema, type LogSchemaIn } from "$lib/schemas";
import { FormError, redirectOnFail } from "$lib/server/effect/errors";
import { parse, safeParse, saveForm, validateForm } from "$lib/server/effect/forms";
import { guardedCommand } from "$lib/server/effect/remote";
import { CharacterService } from "$lib/server/effect/services/characters";
import { LogService } from "$lib/server/effect/services/logs";
import type { SuperValidated } from "sveltekit-superforms";
import * as v from "valibot";

export const save = guardedCommand(function* (input: LogSchemaIn, { user }) {
	const Characters = yield* CharacterService;
	const Logs = yield* LogService;

	let form: SuperValidated<LogSchema>;
	let redirectTo: Pathname;

	if (input.isDmLog) {
		const parsedId = yield* safeParse(v.nullable(characterIdSchema), input.characterId);

		const characters = input.characterId
			? yield* Characters.get.userCharacters(user.id, {
					characterId: parsedId.data || null
				})
			: [];

		form = yield* validateForm(input, dMLogSchema(characters));
		if (!parsedId.success) {
			FormError.from<LogSchema>(parsedId.failure, "characterId").toForm(form);
			return form;
		}

		redirectTo = `/dm-logs`;
	} else {
		const characterId = yield* redirectOnFail(parse(characterIdSchema, input.characterId), "/characters", 302);
		const character = yield* Characters.get.character(characterId);

		form = yield* validateForm(input, characterLogSchema(character));
		redirectTo = `/characters/${character.id}`;
	}

	if (!form.valid) return form;

	return yield* saveForm(Logs.set.save(form.data, user), {
		onSuccess: () => redirectTo,
		onError: (err) => {
			err.toForm(form);
			return form;
		}
	});
});
