import { guardedQuery } from "$lib/server/effect/remote";
import { assertAuth } from "$lib/server/effect/services/auth";
import { DMService } from "$lib/server/effect/services/dms";

export const getAll = guardedQuery(function* () {
	const { user } = yield* assertAuth();
	const DMs = yield* DMService;
	return yield* DMs.get.all(user);
});
