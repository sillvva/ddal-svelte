import { guardedQuery } from "$lib/server/effect/remote";
import { DMService } from "$lib/server/effect/services/dms";

export const getAll = guardedQuery(function* ({ user }) {
	const DMs = yield* DMService;
	return yield* DMs.get.all(user);
});
