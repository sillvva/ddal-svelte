import { defaultLogSchema, getItemEntities, logDataToSchema } from "$lib/entities.js";
import { characterLogSchema, logIdSchema } from "$lib/schemas";
import { RedirectError } from "$lib/server/effect/errors";
import { parse, validateForm } from "$lib/server/effect/forms";
import { runAuth } from "$lib/server/effect/runtime";
import { DMService } from "$lib/server/effect/services/dms.js";
import { LogNotFoundError, LogService } from "$lib/server/effect/services/logs.js";
import { sorter } from "@sillvva/utils";
import { Effect } from "effect";
import * as v from "valibot";

export const load = (event) =>
	runAuth(function* (user) {
		const Logs = yield* LogService;
		const DMs = yield* DMService;

		const parent = yield* Effect.promise(event.parent);
		const character = parent.character;

		const logId = yield* parse(v.union([logIdSchema, v.literal("new")]), event.params.logId, `/characters/${character.id}`, 302);
		const logData = logId !== "new" ? yield* Logs.get.log(logId, user.id) : undefined;
		const log = logData ? logDataToSchema(user.id, logData) : defaultLogSchema(user.id, { character });

		if (logId !== "new") {
			if (!log.id) return yield* new LogNotFoundError();
			if (log.isDmLog) return yield* new RedirectError("Redirecting to DM log", `/dm-logs/${log.id}`, 302);
		}

		const form = yield* validateForm(log, characterLogSchema(character), {
			errors: logId !== "new"
		});

		const itemEntities = getItemEntities(character, { excludeDropped: true, lastLogId: log.id });
		const magicItems = itemEntities.magicItems.toSorted((a, b) => sorter(a.name, b.name));
		const storyAwards = itemEntities.storyAwards.toSorted((a, b) => sorter(a.name, b.name));
		const dms = yield* DMs.get.userDMs(user.id);

		return {
			...event.params,
			totalLevel: character.totalLevel,
			user: { ...user, ...parent.user },
			magicItems,
			storyAwards,
			dms,
			form,
			firstLog: event.url.searchParams.get("firstLog") === "true"
		};
	});
