import { defaultLogSchema, logDataToSchema } from "$lib/entities.js";
import { dMLogSchema, logIdOrNewSchema } from "$lib/schemas";
import { RedirectError } from "$lib/server/effect/errors";
import { parse, validateForm } from "$lib/server/effect/forms";
import { runAuth } from "$lib/server/effect/runtime.js";
import { CharacterService } from "$lib/server/effect/services/characters.js";
import { LogNotFoundError, LogService } from "$lib/server/effect/services/logs";
import { Effect } from "effect";

export const load = (event) =>
	runAuth(function* (user) {
		const Logs = yield* LogService;
		const Characters = yield* CharacterService;

		const logId = yield* parse(logIdOrNewSchema, event.params.logId || "new", `/dm-logs`, 302);
		const logData = yield* Logs.get.log(logId, user.id);
		const log = logData ? logDataToSchema(user.id, logData) : defaultLogSchema(user.id);

		if (logId !== "new") {
			if (!log.id) return yield* new LogNotFoundError();
			if (!log.isDmLog)
				return yield* new RedirectError("Redirecting to character log", `/characters/${log.characterId}/log/${log.id}`, 302);
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

		const form = yield* validateForm(log, dMLogSchema(characters.filter((c) => c.id !== log.characterId)), {
			errors: logId !== "new"
		});

		return {
			...event.params,
			characters: characters.map((c) => ({ id: c.id, name: c.name })),
			form
		};
	});
