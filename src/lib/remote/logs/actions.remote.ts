import { command } from "$app/server";
import { logIdSchema } from "$lib/schemas";
import { runSafe } from "$lib/server/effect/runtime";
import { assertAuth } from "$lib/server/effect/services/auth";
import { LogService } from "$lib/server/effect/services/logs";

export const deleteLog = command(logIdSchema, (id) =>
	runSafe(function* () {
		const { user } = yield* assertAuth();
		const Logs = yield* LogService;
		return yield* Logs.set.delete(id, user.id);
	})
);
