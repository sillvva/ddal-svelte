import { command } from "$app/server";
import type { Pathname } from "$app/types";
import { characterIdSchema, characterLogSchema, dMLogSchema, type LogSchema, type LogSchemaIn } from "$lib/schemas";
import type { ErrorParams } from "$lib/server/effect/errors";
import { FormError, RedirectError } from "$lib/server/effect/errors";
import { parse, saveForm, validateForm } from "$lib/server/effect/forms";
import { authReturn } from "$lib/server/effect/runtime";
import { CharacterService } from "$lib/server/effect/services/characters";
import { LogService } from "$lib/server/effect/services/logs";
import { Data } from "effect";
import type { SuperValidated } from "sveltekit-superforms";
import * as v from "valibot";

class InvalidCharacterIdError extends Data.TaggedError("InvalidCharacterIdError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Invalid character ID", status: 400, cause: err });
	}
}

export const save = command("unchecked", (input: LogSchemaIn) =>
	authReturn(function* (user) {
		const Characters = yield* CharacterService;
		const Logs = yield* LogService;

		let form: SuperValidated<LogSchema>;
		let redirectTo: Pathname;

		if (input.isDmLog) {
			const parsedId = v.safeParse(v.nullable(characterIdSchema), input.characterId);

			const characters = input.characterId
				? yield* Characters.get.userCharacters(user.id, {
						characterId: parsedId.success ? parsedId.output : null
					})
				: [];

			form = yield* validateForm(input, dMLogSchema(characters));
			if (!parsedId.success) {
				FormError.from<LogSchema>(new InvalidCharacterIdError(), "characterId").toForm(form);
				return form;
			}

			redirectTo = `/dm-logs`;
		} else {
			const characterId = yield* parse(characterIdSchema, input.characterId, "/characters", 404);
			const character = yield* Characters.get.character(characterId);

			form = yield* validateForm(input, characterLogSchema(character));
			redirectTo = `/characters/${character.id}`;
		}

		if (!form.valid) return form;

		const logId = form.data.id;
		const log = logId !== "new" ? yield* Logs.get.log(logId, user.id) : undefined;
		if (logId !== "new" && !log?.id) return yield* new RedirectError("Log not found", redirectTo, 404);

		return yield* saveForm(Logs.set.save(form.data, user), {
			onError: (err) => {
				err.toForm(form);
				return form;
			},
			onSuccess: () => redirectTo
		});
	})
);
