import { logIdSchema } from "#lib/schemas.js";
import { guardedCommand } from "#lib/server/effect/guarded.js";
import { LogService } from "#lib/server/effect/services/logs.js";

export const deleteLog = guardedCommand(logIdSchema, function* (id, { user }) {
	const Logs = yield* LogService;
	return yield* Logs.delete(id, user.id);
});
