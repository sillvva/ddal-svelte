import { defaultLogSchema, getItemEntities, logDataToSchema } from "$lib/entities.js";
import { characterLogSchema, logIdOrNewSchema } from "$lib/schemas";
import { assertAuthOrRedirect } from "$lib/server/auth";
import { runOrThrow, validateForm } from "$lib/server/effect";
import { withDM } from "$lib/server/effect/dms.js";
import { LogNotFoundError, withLog } from "$lib/server/effect/logs.js";
import { sorter } from "@sillvva/utils";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import * as v from "valibot";

export const load = (event) =>
	runOrThrow(function* () {
		const user = yield* assertAuthOrRedirect();

		const parent = yield* Effect.promise(event.parent);
		const character = parent.character;

		const idResult = v.safeParse(logIdOrNewSchema, event.params.logId);
		if (!idResult.success) redirect(307, `/character/${character.id}`);
		const logId = idResult.output;

		const logData = yield* withLog((service) => service.get.log(logId, user.id));
		const log = logData ? logDataToSchema(user.id, logData) : defaultLogSchema(user.id, { character });

		if (logId !== "new") {
			if (!log.id) return yield* new LogNotFoundError();
			if (log.isDmLog) redirect(307, `/dm-logs/${log.id}`);
		}

		const form = yield* validateForm(log, characterLogSchema(character));

		const itemEntities = getItemEntities(character, { excludeDropped: true, lastLogId: log.id });
		const magicItems = itemEntities.magicItems.toSorted((a, b) => sorter(a.name, b.name));
		const storyAwards = itemEntities.storyAwards.toSorted((a, b) => sorter(a.name, b.name));
		const dms = yield* withDM((service) => service.get.userDMs(user.id));

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
