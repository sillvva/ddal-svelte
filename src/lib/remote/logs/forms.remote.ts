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
import { FormError, RedirectError, redirectOnFail } from "$lib/server/effect/errors";
import { parse, safeParse, saveForm, validateForm } from "$lib/server/effect/forms";
import { runSafe } from "$lib/server/effect/runtime";
import { assertAuth } from "$lib/server/effect/services/auth";
import { CharacterService } from "$lib/server/effect/services/characters";
import { LogService } from "$lib/server/effect/services/logs";
import type { SuperValidated } from "sveltekit-superforms";
import * as v from "valibot";

export const save = command("unchecked", (input: { logId: LogIdParam; data: LogSchemaIn }) =>
	runSafe(function* () {
		const { user } = yield* assertAuth();
		const Characters = yield* CharacterService;
		const Logs = yield* LogService;

		let form: SuperValidated<LogSchema>;
		let redirectTo: Pathname;

		if (input.data.isDmLog) {
			const parsedId = yield* safeParse(v.nullable(characterIdSchema), input.data.characterId);

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
			const characterId = yield* redirectOnFail(parse(characterIdSchema, input.data.characterId), "/characters", 302);
			const character = yield* Characters.get.character(characterId);

			form = yield* validateForm(input.data, characterLogSchema(character));
			redirectTo = `/characters/${character.id}`;
		}

		if (!form.valid) return form;

		const logId = yield* redirectOnFail(parse(logIdParamSchema, input.logId), redirectTo, 302);
		const log = logId !== "new" ? yield* Logs.get.log(logId, user.id) : undefined;
		if (logId !== "new" && !log) return yield* new RedirectError({ message: "Log not found", redirectTo });

		return yield* saveForm(Logs.set.save(form.data, user), {
			onSuccess: () => redirectTo,
			onError: (err) => {
				err.toForm(form);
				return form;
			}
		});
	})
);
