import { command } from "$app/server";
import type { Pathname } from "$app/types";
import {
	characterIdSchema,
	characterLogSchema,
	dMLogSchema,
	logIdParamSchema,
	type LogIdParam,
	type LogSchema,
	type LogSchemaIn
} from "$lib/schemas";
import { FormError, RedirectError } from "$lib/server/effect/errors";
import { parse, parseEither, saveForm, validateForm } from "$lib/server/effect/forms";
import { runAuthSafe } from "$lib/server/effect/runtime";
import { CharacterService } from "$lib/server/effect/services/characters";
import { LogService } from "$lib/server/effect/services/logs";
import type { SuperValidated } from "sveltekit-superforms";
import * as v from "valibot";

export const save = command("unchecked", (input: { logId: LogIdParam; data: LogSchemaIn }) =>
	runAuthSafe(function* (user) {
		const Characters = yield* CharacterService;
		const Logs = yield* LogService;

		let form: SuperValidated<LogSchema>;
		let redirectTo: Pathname;

		if (input.data.isDmLog) {
			const parsedId = yield* parseEither(v.nullable(characterIdSchema), input.data.characterId);

			const characters = input.data.characterId
				? yield* Characters.get.userCharacters(user.id, {
						characterId: parsedId.data || null
					})
				: [];

			form = yield* validateForm(input.data, dMLogSchema(characters));
			if (!parsedId.success) {
				FormError.from<LogSchema>(parsedId.failure, "characterId").toForm(form);
				return form;
			}

			redirectTo = `/dm-logs`;
		} else {
			const characterId = yield* parse(characterIdSchema, input.data.characterId, "/characters", 301);
			const character = yield* Characters.get.character(characterId);

			form = yield* validateForm(input.data, characterLogSchema(character));
			redirectTo = `/characters/${character.id}`;
		}

		if (!form.valid) return form;

		const logId = yield* parse(logIdParamSchema, input.logId, redirectTo, 302);
		const log = logId !== "new" ? yield* Logs.get.log(logId, user.id) : undefined;
		if (logId !== "new" && !log) return yield* new RedirectError("Log not found", redirectTo, 302);

		return yield* saveForm(Logs.set.save(form.data, user), {
			onError: (err) => {
				err.toForm(form);
				return form;
			},
			onSuccess: () => redirectTo
		});
	})
);
