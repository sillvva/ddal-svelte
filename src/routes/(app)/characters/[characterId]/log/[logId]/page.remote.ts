import { command } from "$app/server";
import { characterIdSchema, characterLogSchema, logIdOrNewSchema, type LogSchemaIn } from "$lib/schemas";
import { assertAuthOrFail } from "$lib/server/auth";
import { runOrThrow, save, validateForm } from "$lib/server/effect";
import { withCharacter } from "$lib/server/effect/characters";
import { withLog } from "$lib/server/effect/logs";
import { redirect } from "@sveltejs/kit";
import * as v from "valibot";

export const saveLog = command("unchecked", (input: LogSchemaIn) =>
	runOrThrow(function* () {
		const user = yield* assertAuthOrFail();

		const characterId = v.parse(characterIdSchema, input.characterId);
		const character = yield* withCharacter((service) => service.get.character(characterId));
		if (!character) redirect(302, "/characters");

		const idResult = v.safeParse(logIdOrNewSchema, input.id);
		if (!idResult.success) redirect(302, `/character/${character.id}`);
		const logId = idResult.output;

		const log = logId !== "new" ? yield* withLog((service) => service.get.log(logId, user.id)) : undefined;
		if (logId !== "new" && !log?.id) redirect(302, `/characters/${character.id}`);

		const form = yield* validateForm(input, characterLogSchema(character));
		if (!form.valid) return form;

		return yield* save(
			withLog((service) => service.set.save(form.data, user)),
			{
				onError: (err) => {
					err.toForm(form);
					return form;
				},
				onSuccess: () => `/characters/${character.id}`
			}
		);
	})
);
