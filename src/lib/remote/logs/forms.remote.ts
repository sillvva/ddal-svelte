import { defaultLogSchema, getItemEntities, logDataToSchema } from "$lib/entities";
import {
	characterIdParamSchema,
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
import { invalid, redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import * as v from "valibot";

const characterLogFormSchema = v.object({
	characterId: characterIdParamSchema,
	logId: logIdParamSchema,
	firstLog: v.optional(v.boolean(), false)
});

export const character = guardedQuery(characterLogFormSchema, function* (input, { user }) {
	const Logs = yield* LogService;
	const Characters = yield* CharacterService;

	if (input.characterId === "new") redirect(302, "/characters/new/edit");
	const characterId = input.characterId;
	const character = yield* Characters.get.one(characterId);

	const logId = input.logId;
	const logData = logId !== "new" ? yield* Logs.get.one(logId, user.id) : undefined;
	const log = logData
		? logDataToSchema(user.id, logData)
		: defaultLogSchema(user.id, {
				character,
				defaults: input.firstLog ? { name: "Character Creation" } : undefined
			});

	if (logId !== "new") {
		if (!log.id) return yield* new LogNotFoundError();
		if (log.isDmLog) return yield* new RedirectError({ message: "Redirecting to DM log", redirectTo: `/dm-logs/${log.id}` });
	}

	const { magicItems, storyAwards } = getItemEntities(character, { excludeDropped: true, lastLogId: logId });

	return {
		log: {
			...log,
			characterId,
			date: log.date.getTime(),
			appliedDate: log.appliedDate?.getTime() || 0
		},
		magicItems,
		storyAwards
	};
});

const dmLogFormSchema = v.object({
	param: v.object({
		logId: logIdParamSchema
	})
});

export const dm = guardedQuery(dmLogFormSchema, function* (input, { user }) {
	const Logs = yield* LogService;
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

	return {
		...omit(log, ["dm"]),
		characterId: log.characterId || "",
		date: log.date.getTime(),
		appliedDate: log.appliedDate?.getTime() || 0
	};
});

export const saveCharacter = guardedForm("unchecked", function* (input: LogSchemaIn, { user, issue }) {
	const Characters = yield* CharacterService;
	const Logs = yield* LogService;

	const characterId = yield* redirectOnFail(parse(characterIdSchema, input.characterId), "/characters", 302);
	const character = yield* Characters.get
		.one(characterId)
		.pipe(Effect.tapError((err) => Effect.fail(invalid(issue.characterId(err.message)))));

	const result = yield* safeParse(characterLogSchema(character), input);
	if (!result.success) invalid(...result.failure.issues);

	yield* Logs.set.save(result.data, user).pipe(Effect.tapError((err) => Effect.fail(invalid(err.message))));

	redirect(303, `/characters/${character.id}`);
});

export const saveDM = guardedForm("unchecked", function* (input: DmLogSchemaIn, { user, issue }) {
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
				.pipe(Effect.tapError((err) => Effect.fail(invalid(issue.characterId(err.message)))))
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
