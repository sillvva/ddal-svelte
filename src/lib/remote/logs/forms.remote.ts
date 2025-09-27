import type { Pathname } from "$app/types";
import { defaultLogSchema, getItemEntities, logDataToSchema } from "$lib/entities";
import {
	characterIdSchema,
	characterLogSchema,
	dMLogSchema,
	logIdParamSchema,
	type LogSchema,
	type LogSchemaIn
} from "$lib/schemas";
import { FormError, RedirectError, redirectOnFail } from "$lib/server/effect/errors";
import { parse, safeParse, saveForm, validateForm } from "$lib/server/effect/forms";
import { guardedCommand, guardedQuery } from "$lib/server/effect/remote";
import { CharacterService } from "$lib/server/effect/services/characters";
import { DMNotFoundError, DMService } from "$lib/server/effect/services/dms";
import { LogNotFoundError, LogService } from "$lib/server/effect/services/logs";
import { omit, sorter } from "@sillvva/utils";
import { Effect } from "effect";
import type { SuperValidated } from "sveltekit-superforms";
import * as v from "valibot";

const characterLogFormSchema = v.object({
	param: v.object({
		characterId: characterIdSchema,
		logId: logIdParamSchema
	})
});

export const character = guardedQuery(characterLogFormSchema, function* (input, { user }) {
	const Logs = yield* LogService;
	const DMs = yield* DMService;
	const Characters = yield* CharacterService;

	const character = yield* Characters.get.one(input.param.characterId);

	const logId = input.param.logId;
	const logData = logId !== "new" ? yield* Logs.get.one(logId, user.id) : undefined;
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
	const dms = yield* DMs.get.all(user, { includeLogs: false }).pipe(Effect.map((dms) => dms.map((dm) => omit(dm, ["logs"]))));

	return {
		totalLevel: character.totalLevel,
		magicItems,
		storyAwards,
		dms,
		form
	};
});

const dmLogFormSchema = v.object({
	param: v.object({
		logId: logIdParamSchema
	})
});

export const dm = guardedQuery(dmLogFormSchema, function* (input, { user }) {
	const Logs = yield* LogService;
	const Characters = yield* CharacterService;
	const DMs = yield* DMService;

	const userDM = yield* DMs.get.all(user, { includeLogs: false }).pipe(
		Effect.map((dms) => dms.find((dm) => dm.isUser)),
		Effect.flatMap((dm) => (dm ? Effect.succeed(dm) : Effect.fail(new DMNotFoundError()))),
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		Effect.map(({ logs, ...rest }) => rest)
	);

	const logId = input.param.logId;
	const logData = logId !== "new" ? yield* Logs.get.one(logId, user.id) : undefined;
	const log = logData ? logDataToSchema(user.id, logData) : defaultLogSchema(user.id, { defaults: { dm: userDM } });

	if (logId !== "new") {
		if (!log.id) return yield* new LogNotFoundError();
		if (!log.isDmLog)
			return yield* new RedirectError({
				message: "Redirecting to character log",
				redirectTo: `/characters/${log.characterId}/log/${log.id}`
			});
	}

	const characters = yield* Characters.get.all(user.id).pipe(
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
});

export const save = guardedCommand(function* (input: LogSchemaIn, { user }) {
	const Characters = yield* CharacterService;
	const Logs = yield* LogService;

	let form: SuperValidated<LogSchema>;
	let redirectTo: Pathname;

	if (input.isDmLog) {
		const parsedId = yield* safeParse(v.nullable(characterIdSchema), input.characterId);

		const characters = input.characterId
			? yield* Characters.get.all(user.id, {
					characterId: parsedId.data || null
				})
			: [];

		form = yield* validateForm(input, dMLogSchema(characters));
		if (!parsedId.success) {
			FormError.from<LogSchema>(parsedId.failure, "characterId").toForm(form);
			return form;
		}

		redirectTo = `/dm-logs`;
	} else {
		const characterId = yield* redirectOnFail(parse(characterIdSchema, input.characterId), "/characters", 302);
		const character = yield* Characters.get.one(characterId);

		form = yield* validateForm(input, characterLogSchema(character));
		redirectTo = `/characters/${character.id}`;
	}

	if (!form.valid) return form;

	return yield* saveForm(Logs.set.save(form.data, user), {
		onSuccess: () => redirectTo,
		onError: (err) => {
			err.toForm(form);
			return form;
		}
	});
});
