import { dungeonMasterIdSchema } from "$lib/schemas";
import { guardedQuery } from "$lib/server/effect/remote";
import { DMService } from "$lib/server/effect/services/dms";

export const get = guardedQuery(dungeonMasterIdSchema, function* (input, { user }) {
	const DMs = yield* DMService;
	return yield* DMs.get.one(input, user.id);
});

export const getAll = guardedQuery(function* ({ user }) {
	const DMs = yield* DMService;
	return yield* DMs.get.all(user);
});
