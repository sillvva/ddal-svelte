import { command } from "$app/server";
import { logIdSchema } from "$lib/schemas";
import { authReturn } from "$lib/server/effect/runtime";
import { LogService } from "$lib/server/effect/services/logs";

export const deleteLog = command(logIdSchema, (id) =>
	authReturn(function* (user) {
		const Logs = yield* LogService;
		return yield* Logs.set.delete(id, user.id);
	})
);
