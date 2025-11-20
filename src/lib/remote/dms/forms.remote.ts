import * as API from "$lib/remote";
import { dungeonMasterFormSchema, dungeonMasterIdSchema } from "$lib/schemas";
import { guardedForm, guardedQuery, refreshAll } from "$lib/server/effect/remote";
import { DMService } from "$lib/server/effect/services/dms";
import { invalid, redirect } from "@sveltejs/kit";
import { Effect } from "effect";

export const get = guardedQuery(dungeonMasterIdSchema, function* (input, { user }) {
	const DMs = yield* DMService;
	const dm = yield* DMs.get.one(input, user.id);

	return {
		id: dm.id,
		name: dm.name,
		DCI: dm.DCI || ""
	};
});

export const save = guardedForm(dungeonMasterFormSchema, function* (input, { user }) {
	const DMs = yield* DMService;
	yield* DMs.set.save(user, input).pipe(Effect.tapError((err) => Effect.fail(invalid(err.message))));
	yield* refreshAll(API.dms.queries.get(input.id).refresh(), API.dms.queries.getAll().refresh());
	redirect(303, "/dms");
});
