import { guardedQuery } from "$lib/server/effect/remote";
import { LogService } from "$lib/server/effect/services/logs";

export const getDmLogs = guardedQuery(function* ({ user }) {
	const Logs = yield* LogService;
	return yield* Logs.get.dm(user.id);
});
