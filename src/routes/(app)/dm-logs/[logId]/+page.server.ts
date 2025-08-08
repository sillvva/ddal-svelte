import { defaultLogSchema, logDataToSchema } from "$lib/entities.js";
import { dMLogSchema, logIdOrNewSchema } from "$lib/schemas";
import { assertAuthOrRedirect } from "$lib/server/auth";
import { runOrThrow, validateForm } from "$lib/server/effect";
import { withCharacter } from "$lib/server/effect/characters.js";
import { LogNotFoundError, withLog } from "$lib/server/effect/logs";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import * as v from "valibot";

export const load = (event) =>
	runOrThrow(function* () {
		const user = yield* assertAuthOrRedirect();

		const idResult = v.safeParse(logIdOrNewSchema, event.params.logId || "new");
		if (!idResult.success) redirect(307, `/dm-logs`);
		const logId = idResult.output;

		const characters = yield* withCharacter((service) => service.get.userCharacters(user.id, true)).pipe(
			Effect.map((characters) =>
				characters.map((c) => ({
					...c,
					logs: c.logs.filter((l) => l.id !== logId),
					magicItems: [],
					storyAwards: [],
					logLevels: []
				}))
			)
		);

		const logData = yield* withLog((service) => service.get.log(logId, user.id));
		const log = logData ? logDataToSchema(user.id, logData) : defaultLogSchema(user.id);

		if (logId !== "new") {
			if (!log.id) return yield* new LogNotFoundError();
			if (!log.isDmLog) redirect(307, `/characters/${log.characterId}/log/${log.id}`);
		}

		const form = yield* validateForm(log, dMLogSchema(characters));

		return {
			...event.params,
			characters: characters.map((c) => ({ id: c.id, name: c.name })),
			form
		};
	});
