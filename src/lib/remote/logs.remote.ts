import { command } from "$app/server";
import type { Pathname } from "$app/types";
import { characterIdSchema, characterLogSchema, dMLogSchema, logIdSchema, type LogSchema, type LogSchemaIn } from "$lib/schemas";
import { type ErrorParams, FormError } from "$lib/server/effect/errors";
import { save, validateForm } from "$lib/server/effect/forms";
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

export const saveLog = command("unchecked", (input: LogSchemaIn) =>
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
			const characterId = v.parse(characterIdSchema, input.characterId);
			const character = yield* Characters.get.character(characterId);

			form = yield* validateForm(input, characterLogSchema(character));
			redirectTo = `/characters/${character.id}`;
		}

		if (!form.valid) return form;

		const logId = form.data.id;
		const log = logId !== "new" ? yield* Logs.get.log(logId, user.id) : undefined;
		if (logId !== "new" && !log?.id) return redirectTo;

		return yield* save(Logs.set.save(form.data, user), {
			onError: (err) => {
				err.toForm(form);
				return form;
			},
			onSuccess: () => redirectTo
		});
	})
);

export const deleteLog = command(logIdSchema, (id) =>
	authReturn(function* (user) {
		const Logs = yield* LogService;
		return yield* Logs.set.delete(id, user.id);
	})
);
