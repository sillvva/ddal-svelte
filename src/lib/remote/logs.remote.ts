import { command } from "$app/server";
import type { Pathname } from "$app/types";
import {
	characterIdSchema,
	characterLogSchema,
	dMLogSchema,
	logIdOrNewSchema,
	logIdSchema,
	type LogSchema,
	type LogSchemaIn
} from "$lib/schemas";
import { assertAuthOrFail } from "$lib/server/auth";
import { runOrReturn, save, validateForm } from "$lib/server/effect";
import { withCharacter } from "$lib/server/effect/characters";
import { withLog } from "$lib/server/effect/logs";
import { redirect } from "@sveltejs/kit";
import type { SuperValidated } from "sveltekit-superforms";
import * as v from "valibot";

export const saveLog = command("unchecked", (input: LogSchemaIn) =>
	runOrReturn(function* () {
		const user = yield* assertAuthOrFail();

		let form: SuperValidated<LogSchema>;
		let redirectTo: Pathname;

		if (input.isDmLog) {
			const characters = yield* withCharacter((service) => service.get.userCharacters(user.id, true));

			form = yield* validateForm(input, dMLogSchema(characters));
			redirectTo = `/dm-logs`;
		} else {
			const characterId = v.parse(characterIdSchema, input.characterId);
			const character = yield* withCharacter((service) => service.get.character(characterId));
			if (!character) redirect(302, "/characters");

			form = yield* validateForm(input, characterLogSchema(character));
			redirectTo = `/characters/${character.id}`;
		}

		if (!form.valid) return form;

		const idResult = v.safeParse(logIdOrNewSchema, input.id);
		if (!idResult.success) redirect(302, redirectTo);
		const logId = idResult.output;

		const log = logId !== "new" ? yield* withLog((service) => service.get.log(logId, user.id)) : undefined;
		if (logId !== "new" && !log?.id) redirect(302, redirectTo);

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
