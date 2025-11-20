import { dungeonMasterIdSchema } from "$lib/schemas";
import { guardedQuery } from "$lib/server/effect/remote";
import { DMService } from "$lib/server/effect/services/dms";
import { omit } from "@sillvva/utils";
import { Effect } from "effect";

export const get = guardedQuery(dungeonMasterIdSchema, function* (input, { user }) {
	const DMs = yield* DMService;
	return yield* DMs.get.one(input, user.id);
});

export const getAll = guardedQuery(function* ({ user }) {
	const DMs = yield* DMService;
	return yield* DMs.get.all(user);
});

export const getAllWithoutLogs = guardedQuery(function* ({ user }) {
	const DMs = yield* DMService;
	return yield* DMs.get.all(user, false).pipe(Effect.map((dms) => dms.map((dm) => omit(dm, ["logs"]))));
});
