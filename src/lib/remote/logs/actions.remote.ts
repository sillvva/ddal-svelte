import { logIdSchema } from "$lib/schemas";
import { guardedCommand } from "$lib/server/effect/remote";
import { LogService } from "$lib/server/effect/services/logs";

export const deleteLog = guardedCommand(logIdSchema, function* (id, { user }) {
	const Logs = yield* LogService;
	return yield* Logs.set.delete(id, user.id);
});
