import { defaultLogSchema, getItemEntities, logDataToSchema } from "$lib/entities.js";
import { characterLogSchema } from "$lib/schemas";
import { RedirectError } from "$lib/server/effect/errors";
import { validateForm } from "$lib/server/effect/forms";
import { run } from "$lib/server/effect/runtime";
import { assertAuth } from "$lib/server/effect/services/auth";
import { DMService } from "$lib/server/effect/services/dms.js";
import { LogNotFoundError, LogService } from "$lib/server/effect/services/logs.js";
import { sorter } from "@sillvva/utils";
import { Effect } from "effect";

export const load = (event) =>
	run(function* () {
		const { user } = yield* assertAuth();
		const Logs = yield* LogService;
		const DMs = yield* DMService;

		const parent = yield* Effect.promise(event.parent);
		const character = parent.character;

		const logId = event.params.logId;
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
