import { defaultLogSchema, logDataToSchema } from "$lib/entities.js";
import { dMLogSchema } from "$lib/schemas";
import { RedirectError } from "$lib/server/effect/errors";
import { validateForm } from "$lib/server/effect/forms";
import { run } from "$lib/server/effect/runtime.js";
import { assertAuth } from "$lib/server/effect/services/auth";
import { CharacterService } from "$lib/server/effect/services/characters.js";
import { DMNotFoundError, DMService } from "$lib/server/effect/services/dms.js";
import { LogNotFoundError, LogService } from "$lib/server/effect/services/logs";
import { Effect } from "effect";

export const load = (event) =>
	run(function* () {
		const { user } = yield* assertAuth();

		const Logs = yield* LogService;
		const Characters = yield* CharacterService;
		const DMs = yield* DMService;

		const userDM = yield* DMs.get.userDMs(user.id, { includeLogs: false }).pipe(
			Effect.map((dms) => dms.find((dm) => dm.isUser)),
			Effect.flatMap((dm) => (dm ? Effect.succeed(dm) : Effect.fail(new DMNotFoundError()))),
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			Effect.map(({ logs, ...rest }) => rest)
		);

		const logId = event.params.logId;
		const logData = logId !== "new" ? yield* Logs.get.log(logId, user.id) : undefined;
		const log = logData ? logDataToSchema(user.id, logData) : defaultLogSchema(user.id, { defaults: { dm: userDM } });

		if (logId !== "new") {
			if (!log.id) return yield* new LogNotFoundError();
			if (!log.isDmLog)
				return yield* new RedirectError({
					message: "Redirecting to character log",
					redirectTo: `/characters/${log.characterId}/log/${log.id}`
				});
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

		const form = yield* validateForm(log, dMLogSchema(characters.filter((c) => c.id === log.characterId)), {
			errors: logId !== "new"
		});

		return {
			...event.params,
			characters: characters.map((c) => ({ id: c.id, name: c.name })),
			form
		};
	});
