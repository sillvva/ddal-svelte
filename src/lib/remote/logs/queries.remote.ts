import { query } from "$app/server";
import { defaultLogSchema, getItemEntities, logDataToSchema } from "$lib/entities";
import { characterIdSchema, characterLogSchema, dMLogSchema, logIdParamSchema } from "$lib/schemas";
import { RedirectError } from "$lib/server/effect/errors";
import { validateForm } from "$lib/server/effect/forms";
import { run } from "$lib/server/effect/runtime";
import { assertAuth } from "$lib/server/effect/services/auth";
import { CharacterService } from "$lib/server/effect/services/characters";
import { DMNotFoundError, DMService } from "$lib/server/effect/services/dms";
import { LogNotFoundError, LogService } from "$lib/server/effect/services/logs";
import { omit, sorter } from "@sillvva/utils";
import { Effect } from "effect";
import * as v from "valibot";
import { getCharacter } from "../characters/queries.remote";

export const getCharacterLogForm = query(
	v.object({
		param: v.object({
			characterId: characterIdSchema,
			logId: logIdParamSchema
		})
	}),
	(input) =>
		run(function* () {
			const { user } = yield* assertAuth();
			const Logs = yield* LogService;
			const DMs = yield* DMService;

			const character = yield* Effect.promise(() => getCharacter({ param: input.param.characterId }));

			const logId = input.param.logId;
			const logData = logId !== "new" ? yield* Logs.get.log(logId, user.id) : undefined;
			const log = logData ? logDataToSchema(user.id, logData) : defaultLogSchema(user.id, { character });

			if (logId !== "new") {
				if (!log.id) return yield* new LogNotFoundError();
				if (log.isDmLog) return yield* new RedirectError({ message: "Redirecting to DM log", redirectTo: `/dm-logs/${log.id}` });
			}

			const form = yield* validateForm(log, characterLogSchema(character), {
				errors: logId !== "new"
			});

			const itemEntities = getItemEntities(character, { excludeDropped: true, lastLogId: log.id });
			const magicItems = itemEntities.magicItems.toSorted((a, b) => sorter(a.name, b.name));
			const storyAwards = itemEntities.storyAwards.toSorted((a, b) => sorter(a.name, b.name));
			const dms = yield* DMs.get
				.userDMs(user, { includeLogs: false })
				.pipe(Effect.map((dms) => dms.map((dm) => omit(dm, ["logs"]))));

			return {
				totalLevel: character.totalLevel,
				magicItems,
				storyAwards,
				dms,
				form
			};
		})
);

export const getDmLogs = query(() =>
	run(function* () {
		const { user } = yield* assertAuth();
		const Logs = yield* LogService;

		const logs = yield* Logs.get.dmLogs(user.id);

		return logs;
	})
);

export const getDMLogForm = query(
	v.object({
		param: v.object({
			logId: logIdParamSchema
		})
	}),
	(input) =>
		run(function* () {
			const { user } = yield* assertAuth();

			const Logs = yield* LogService;
			const Characters = yield* CharacterService;
			const DMs = yield* DMService;

			const userDM = yield* DMs.get.userDMs(user, { includeLogs: false }).pipe(
				Effect.map((dms) => dms.find((dm) => dm.isUser)),
				Effect.flatMap((dm) => (dm ? Effect.succeed(dm) : Effect.fail(new DMNotFoundError()))),
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				Effect.map(({ logs, ...rest }) => rest)
			);

			const logId = input.param.logId;
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
				characters: characters.map((c) => ({ id: c.id, name: c.name })),
				form
			};
		})
);
