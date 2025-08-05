import { command } from "$app/server";
import { dMLogSchema, logIdOrNewSchema, type LogSchemaIn } from "$lib/schemas";
import { assertAuthOrFail } from "$lib/server/auth";
import { run, saveRemote, validateForm } from "$lib/server/effect";
import { withCharacter } from "$lib/server/effect/characters";
import { withLog } from "$lib/server/effect/logs";
import { redirect } from "@sveltejs/kit";
import * as v from "valibot";

export const saveLog = command("unchecked", (input: LogSchemaIn) =>
	run(function* () {
		const user = yield* assertAuthOrFail();

		const idResult = v.safeParse(logIdOrNewSchema, input.id || "new");
		if (!idResult.success) redirect(302, `/dm-logs`);
		const logId = idResult.output;

		const log = logId !== "new" ? yield* withLog((service) => service.get.log(logId, user.id)) : undefined;
		if (logId !== "new" && !log?.id) redirect(302, `/dm-logs`);

		const characters = yield* withCharacter((service) => service.get.userCharacters(user.id, true));

		const form = yield* validateForm(input, dMLogSchema(characters));
		if (!form.valid) return form;

		return saveRemote(
			withLog((service) => service.set.save(form.data, user)),
			{
				onError: (err) => {
					err.toForm(form);
					return form;
				},
				onSuccess: () => `/dm-logs`
			}
		);
	})
);
