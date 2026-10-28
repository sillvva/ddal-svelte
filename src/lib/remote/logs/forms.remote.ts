import { defaultLogSchema, logDataToSchema } from "#lib/entities.js";
import * as API from "#lib/remote/index.js";
import {
	characterIdSchema,
	characterLogSchema,
	dMLogSchema,
	logIdParamSchema,
	orEmpty,
	type DmLogSchemaIn,
	type LogSchemaIn
} from "#lib/schemas.js";
import { RedirectError, redirectOnFail } from "#lib/server/effect/errors.js";
import { guardedForm, guardedQuery, refreshAll } from "#lib/server/effect/guarded.js";
import { CharacterService } from "#lib/server/effect/services/characters.js";
import { DMNotFoundError, DMService } from "#lib/server/effect/services/dms.js";
import { LogNotFoundError, LogService } from "#lib/server/effect/services/logs.js";
import { formParse, parse } from "#lib/server/effect/util.js";
import { omit } from "@sillvva/utils";
import { invalid, redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import * as v from "valibot";

const characterLogFormSchema = v.object({
	character: v.object({
		id: characterIdSchema,
		name: v.string()
	}),
	logId: logIdParamSchema,
	firstLog: v.optional(v.boolean(), false)
});

export const character = guardedQuery(characterLogFormSchema, function* (input, { user }) {
	const Logs = yield* LogService;

	if (input.character.id === "new") redirect(302, "/characters/new/edit");

	const logId = input.logId;
	const logData = logId !== "new" ? yield* Logs.get.one(logId, user.id) : undefined;
	const log = logData
		? logDataToSchema(user.id, logData)
		: defaultLogSchema(user.id, {
				character: input.character,
				defaults: input.firstLog ? { name: "Character Creation" } : undefined
			});

	if (logId !== "new") {
		if (!log.id) return yield* new LogNotFoundError();
		if (log.isDmLog) return yield* new RedirectError({ message: "Redirecting to DM log", redirectTo: `/dm-logs/${log.id}` });
	}

	return {
		...log,
		characterId: input.character.id,
		date: log.date.getTime(),
		appliedDate: log.appliedDate?.getTime() || 0
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

export const saveCharacter = guardedForm("unchecked", function* (input: LogSchemaIn, { user, issue, event }) {
	const Characters = yield* CharacterService;
	const Logs = yield* LogService;

	const characterId = yield* redirectOnFail(parse(characterIdSchema, input.characterId), "/characters", 302);
	const character = yield* Characters.get
		.one(characterId)
		.pipe(Effect.tapError((err) => Effect.fail(invalid(issue.characterId(err.message)))));

	const result = yield* formParse(characterLogSchema(character), {
		...input,
		timezone: input.timezone || event.locals.app.settings.timezone
	});
	yield* Logs.save(result, user).pipe(Effect.tapError((err) => Effect.fail(invalid(err.message))));

	yield* refreshAll(API.characters.queries.get({ param: character.id, newRedirect: true }).refresh());

	redirect(303, `/characters/${character.id}`);
});

export const saveDM = guardedForm("unchecked", function* (input: DmLogSchemaIn, { user, issue, event }) {
	const Characters = yield* CharacterService;
	const Logs = yield* LogService;
	const DMs = yield* DMService;

	const userDM = yield* DMs.get.all(user, false).pipe(
		Effect.map((dms) => dms.find((dm) => dm.isUser)),
		Effect.flatMap((dm) => (dm ? Effect.succeed(dm) : Effect.fail(new DMNotFoundError()))),
		Effect.map((dm) => omit(dm, ["logs"]))
	);

	const parsedId = yield* formParse(orEmpty(characterIdSchema), input.characterId);

	const characters = parsedId
		? yield* Characters.get
				.all(user.id, {
					characterId: parsedId
				})
				.pipe(Effect.tapError((err) => Effect.fail(invalid(issue.characterId(err.message)))))
		: [];

	const result = yield* formParse(dMLogSchema(characters), {
		...input,
		timezone: input.timezone || event.locals.app.settings.timezone
	});

	const log = {
		...result,
		dm: userDM
	};

	yield* Logs.save(log, user).pipe(Effect.tapError((err) => Effect.fail(invalid(err.message))));

	yield* refreshAll(API.logs.queries.getDmLogs().refresh());

	redirect(303, `/dm-logs`);
});
