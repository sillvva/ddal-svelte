import { appLogId } from "$lib/schemas";
import { AppLog } from "$lib/server/effect/logging";
import { guardedCommand } from "$lib/server/effect/remote";
import { AdminService } from "$lib/server/effect/services/admin";
import * as v from "valibot";

export const deleteAppLog = guardedCommand(
	appLogId,
	function* (id) {
		const Admin = yield* AdminService;
		return yield* Admin.set.deleteLog(id);
	},
	true
);

export const logClientError = guardedCommand(
	v.object({
		message: v.string(),
		name: v.optional(v.string()),
		stack: v.optional(v.string()),
		cause: v.optional(v.unknown())
	}),
	function* ({ message, name, stack, cause }) {
		AppLog.error(message, { error: { name, stack, cause }, source: "client" });
	}
);
