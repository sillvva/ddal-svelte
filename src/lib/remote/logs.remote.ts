import { command } from "$app/server";
import type { Pathname } from "$app/types";
import { characterIdSchema, characterLogSchema, dMLogSchema, logIdSchema, type LogSchema, type LogSchemaIn } from "$lib/schemas";
import { assertAuthOrFail } from "$lib/server/auth";
import { FormError, runOrReturn, save, validateForm, type ErrorParams } from "$lib/server/effect";
import { withCharacter } from "$lib/server/effect/characters";
import { withLog } from "$lib/server/effect/logs";
import { Data } from "effect";
import type { SuperValidated } from "sveltekit-superforms";
import * as v from "valibot";

class InvalidCharacterIdError extends Data.TaggedError("InvalidCharacterIdError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Invalid character ID", status: 400, cause: err });
	}
}

export const saveLog = command("unchecked", (input: LogSchemaIn) =>
	runOrReturn(function* () {
		const user = yield* assertAuthOrFail();

		let form: SuperValidated<LogSchema>;
		let redirectTo: Pathname;

		if (input.isDmLog) {
			const parsedId = v.safeParse(characterIdSchema, input.characterId);

			const characters = input.characterId
				? yield* withCharacter((service) =>
						service.get.userCharacters(user.id, {
							characterId: parsedId.success ? parsedId.output : null
						})
					)
				: [];

			form = yield* validateForm(input, dMLogSchema(characters));
			if (!parsedId.success) {
				form.valid = false;
				FormError.from<LogSchema>(new InvalidCharacterIdError(), "characterId").toForm(form);
				return form;
			}

			redirectTo = `/dm-logs`;
		} else {
			const characterId = v.parse(characterIdSchema, input.characterId);
			const character = yield* withCharacter((service) => service.get.character(characterId));
			if (!character) return "/characters";

			form = yield* validateForm(input, characterLogSchema(character));
			redirectTo = `/characters/${character.id}`;
		}

		if (!form.valid) return form;

		const logId = form.data.id;
		const log = logId !== "new" ? yield* withLog((service) => service.get.log(logId, user.id)) : undefined;
		if (logId !== "new" && !log?.id) return redirectTo;

		return yield* save(
			withLog((service) => service.set.save(form.data, user)),
			{
				onError: (err) => {
					err.toForm(form);
					return form;
				},
				onSuccess: () => redirectTo
			}
		);
	})
);

export const deleteLog = command(logIdSchema, (id) =>
	runOrReturn(function* () {
		const user = yield* assertAuthOrFail();
		return yield* withLog((service) => service.set.delete(id, user.id));
	})
);
