import { draftDescriptionHasNewImages } from "#lib/log-draft.js";
import * as API from "#lib/remote/index.js";
import { logDraftDataSchema, logDraftIdParamSchema, logDraftSchema, type LogDraftSchemaIn } from "#lib/schemas.js";
import { guardedForm, guardedQuery, refreshAll } from "#lib/server/effect/guarded.js";
import { DMNotFoundError, DMService } from "#lib/server/effect/services/dms.js";
import { LogDraftService } from "#lib/server/effect/services/log-drafts.js";
import { formParse } from "#lib/server/effect/util.js";
import { R2_PUBLIC_URL } from "$app/env/public";
import { invalid, redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import * as v from "valibot";

const loadSchema = v.object({
	draftId: logDraftIdParamSchema
});

export const load = guardedQuery(loadSchema, function* (input, { user, event }) {
	const Drafts = yield* LogDraftService;

	if (input.draftId === "new") {
		const DMs = yield* DMService;
		const userDM = yield* DMs.get.all(user, false).pipe(
			Effect.map((dms) => dms.find((dm) => dm.isUser)),
			Effect.flatMap((dm) => (dm ? Effect.succeed(dm) : Effect.fail(new DMNotFoundError())))
		);
		return {
			id: "" as const,
			kind: "character" as const,
			name: "",
			date: Date.now(),
			timezone: event.locals.app.settings.timezone,
			type: "game" as const,
			experience: 0,
			acp: 0,
			tcp: 0,
			level: 0,
			gold: 0,
			dtd: 0,
			description: "",
			dm: { name: userDM.name, DCI: userDM.DCI },
			magicItemsGained: [],
			storyAwardsGained: []
		};
	}

	const row = yield* Drafts.readOwned(input.draftId, user.id);
	return {
		id: row.id,
		...row.data,
		date: row.data.date ?? 0,
		dm: { name: row.data.dm.name, DCI: row.data.dm.DCI }
	};
});

export const save = guardedForm("unchecked", function* (input: LogDraftSchemaIn, { user, issue, event }) {
	const Drafts = yield* LogDraftService;
	const parsed = yield* formParse(logDraftSchema, {
		...input,
		timezone: input.timezone || event.locals.app.settings.timezone
	});
	const { id, ...fields } = parsed;
	const data = yield* formParse(logDraftDataSchema, fields);

	if (draftDescriptionHasNewImages(data.description, R2_PUBLIC_URL)) {
		invalid(issue.description("Images can't be uploaded to a log draft."));
	}

	const saved = yield* (id ? Drafts.update(user, id, data) : Drafts.create(user, data)).pipe(
		Effect.tapError((err) => Effect.fail(invalid(err.message)))
	);

	yield* refreshAll(API.drafts.queries.read(saved.id).refresh(), API.drafts.forms.load({ draftId: saved.id }).refresh());
	redirect(303, `/drafts/${saved.id}`);
});
