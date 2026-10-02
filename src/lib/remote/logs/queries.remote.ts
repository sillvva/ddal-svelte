import { guardedQuery } from "#lib/server/effect/guarded.js";
import { LogService } from "#lib/server/effect/services/logs.js";

export const getDmLogs = guardedQuery(function* ({ user }) {
	const Logs = yield* LogService;
	return yield* Logs.get.dm(user.id);
});
