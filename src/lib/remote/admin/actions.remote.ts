import { appLogId } from "#lib/schemas.js";
import { guardedCommand } from "#lib/server/effect/guarded.js";
import { AppLog } from "#lib/server/effect/logging.js";
import { AdminService } from "#lib/server/effect/services/admin.js";
import { requested } from "$app/server";
import { Effect } from "effect";
import * as v from "valibot";
import { getAppLogs } from "./queries.remote";

export const deleteAppLog = guardedCommand(
	appLogId,
	function* (id) {
		const Admin = yield* AdminService;

		const result = yield* Admin.deleteLog(id);
		yield* Effect.promise(() => requested(getAppLogs, 1).refreshAll());

		return result;
	},
	true
);

export const logClientError = guardedCommand(
	v.object({
		message: v.string(),
		status: v.optional(v.number()),
		name: v.optional(v.string()),
		stack: v.optional(v.string()),
		cause: v.optional(v.unknown()),
		boundary: v.optional(v.string())
	}),
	function* ({ message, name, stack, cause, boundary }) {
		yield* AppLog.error(message, { error: { name, stack, cause }, source: boundary ?? "client" });
	}
);
