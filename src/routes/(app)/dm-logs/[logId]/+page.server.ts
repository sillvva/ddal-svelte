import { defaultLogSchema, logDataToSchema } from "$lib/entities.js";
import { dMLogSchema, logIdOrNewSchema } from "$lib/schemas";
import { validateForm } from "$lib/server/effect/forms";
import { authRedirect } from "$lib/server/effect/runtime.js";
import { CharacterService } from "$lib/server/effect/services/characters.js";
import { LogNotFoundError, LogService } from "$lib/server/effect/services/logs";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import * as v from "valibot";

export const load = (event) =>
	authRedirect(function* (user) {
		const Logs = yield* LogService;
		const Characters = yield* CharacterService;

		const idResult = v.safeParse(logIdOrNewSchema, event.params.logId || "new");
		if (!idResult.success) redirect(307, `/dm-logs`);
		const logId = idResult.output;

		const logData = yield* Logs.get.log(logId, user.id);
		const log = logData ? logDataToSchema(user.id, logData) : defaultLogSchema(user.id);

		if (logId !== "new") {
			if (!log.id) return yield* new LogNotFoundError();
			if (!log.isDmLog) redirect(307, `/characters/${log.characterId}/log/${log.id}`);
		}

		const characters = yield* Characters.get.userCharacters(user.id).pipe(
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

		const form = yield* validateForm(log, dMLogSchema(characters.filter((c) => c.id !== log.characterId)));

		return {
			...event.params,
			characters: characters.map((c) => ({ id: c.id, name: c.name })),
			form
		};
	});
