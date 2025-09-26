import { guardedQuery } from "$lib/server/effect/remote";
import { assertAuth } from "$lib/server/effect/services/auth";
import { DMService } from "$lib/server/effect/services/dms";

export const getDMs = guardedQuery(function* () {
	const { user } = yield* assertAuth();
	const DMs = yield* DMService;
	return yield* DMs.get.userDMs(user);
});
