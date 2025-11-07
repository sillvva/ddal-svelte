import { defaultLogSchema, getItemEntities, logDataToSchema } from "$lib/entities";
import {
	characterIdSchema,
	characterLogSchema,
	dMLogSchema,
	logIdParamSchema,
	type DmLogSchemaIn,
	type LogSchemaIn
} from "$lib/schemas";
import { RedirectError, redirectOnFail } from "$lib/server/effect/errors";
import { guardedForm, guardedQuery } from "$lib/server/effect/remote";
import { CharacterService } from "$lib/server/effect/services/characters";
import { DMNotFoundError, DMService } from "$lib/server/effect/services/dms";
import { LogNotFoundError, LogService } from "$lib/server/effect/services/logs";
import { parse, safeParse } from "$lib/server/effect/util";
import { omit } from "@sillvva/utils";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import * as v from "valibot";

const characterLogFormSchema = v.object({
	param: v.object({
		characterId: characterIdSchema,
		logId: logIdParamSchema,
		firstLog: v.optional(v.boolean(), false)
	})
});

export const character = guardedQuery(characterLogFormSchema, function* (input, { user }) {
	const Logs = yield* LogService;
	const DMs = yield* DMService;
	const Characters = yield* CharacterService;

	const character = yield* Characters.get.one(input.param.characterId);

	const logId = input.param.logId;
	const logData = logId !== "new" ? yield* Logs.get.one(logId, user.id) : undefined;
	const log = logData
		? logDataToSchema(user.id, logData)
		: defaultLogSchema(user.id, { character, defaults: input.param.firstLog ? { name: "Character Creation" } : undefined });

	if (logId !== "new") {
		if (!log.id) return yield* new LogNotFoundError();
		if (log.isDmLog) return yield* new RedirectError({ message: "Redirecting to DM log", redirectTo: `/dm-logs/${log.id}` });
	}

	const itemEntities = getItemEntities(character, { excludeDropped: true, lastLogId: log.id });
	const dms = yield* DMs.get.all(user, false).pipe(Effect.map((dms) => dms.map((dm) => omit(dm, ["logs"]))));

	return {
		totalLevel: character.totalLevel,
		magicItems: itemEntities.magicItems,
		storyAwards: itemEntities.storyAwards,
		dms,
		log: {
			...log,
			characterId: log.characterId || "",
			date: log.date.getTime(),
			appliedDate: log.appliedDate?.getTime() || 0
		},
		initialErrors: logId !== "new"
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

	const userDM = yield* DMs.get.all(user, false).pipe(
		Effect.map((dms) => dms.find((dm) => dm.isUser)),
		Effect.flatMap((dm) => (dm ? Effect.succeed(dm) : Effect.fail(new DMNotFoundError()))),
		Effect.map((dm) => omit(dm, ["logs"]))
	);

	const logId = input.param.logId;
	const logData = logId !== "new" ? yield* Logs.get.one(logId, user.id) : undefined;
	const log = logData ? logDataToSchema(user.id, logData) : defaultLogSchema(user.id, { defaults: { dm: userDM } });

	if (logId !== "new") {
		if (!log.id) return yield* new LogNotFoundError();
		if (!log.isDmLog) redirect(302, `/characters/${log.characterId}/log/${log.id}`);
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

	return {
		characters: characters.map((c) => ({ id: c.id, name: c.name })),
		initialErrors: logId !== "new",
		log: {
			...omit(log, ["dm"]),
			characterId: log.characterId || "",
			date: log.date.getTime(),
			appliedDate: log.appliedDate?.getTime() || 0
		}
	};
});

export const saveCharacter = guardedForm(function* (input: LogSchemaIn, { user, invalid }) {
	const Characters = yield* CharacterService;
	const Logs = yield* LogService;

	const characterId = yield* redirectOnFail(parse(characterIdSchema, input.characterId), "/characters", 302);
	const character = yield* Characters.get
		.one(characterId)
		.pipe(Effect.tapError((err) => Effect.fail(invalid(invalid.characterId(err.message)))));

	const result = yield* safeParse(characterLogSchema(character), input);
	if (!result.success) throw invalid(...result.failure.issues);

	yield* Logs.set.save(result.data, user).pipe(Effect.tapError((err) => Effect.fail(invalid(err.message))));

	redirect(303, `/characters/${character.id}`);
});

export const saveDM = guardedForm(function* (input: DmLogSchemaIn, { user, invalid }) {
	const Characters = yield* CharacterService;
	const Logs = yield* LogService;
	const DMs = yield* DMService;

	const userDM = yield* DMs.get.all(user, false).pipe(
		Effect.map((dms) => dms.find((dm) => dm.isUser)),
		Effect.flatMap((dm) => (dm ? Effect.succeed(dm) : Effect.fail(new DMNotFoundError()))),
		Effect.map((dm) => omit(dm, ["logs"]))
	);

	const parsedId = yield* safeParse(characterIdSchema, input.characterId);
	if (!parsedId.success && input.characterId) throw invalid(...parsedId.failure.issues);

	const characters = input.characterId
		? yield* Characters.get
				.all(user.id, {
					characterId: parsedId.data
				})
				.pipe(Effect.tapError((err) => Effect.fail(invalid(invalid.characterId(err.message)))))
		: [];

	const result = yield* safeParse(dMLogSchema(characters), input);
	if (!result.success) throw invalid(...result.failure.issues);

	const log = {
		...result.data,
		dm: userDM
	};

	yield* Logs.set.save(log, user).pipe(Effect.tapError((err) => Effect.fail(invalid(err.message))));

	redirect(303, `/dm-logs`);
});
