import { command } from "$app/server";
import { appLogId } from "$lib/schemas";
import { runAuthSafe } from "$lib/server/effect/runtime";
import { AdminService } from "$lib/server/effect/services/admin";

export const deleteAppLog = command(appLogId, (id) =>
	runAuthSafe(
		function* () {
			const Admin = yield* AdminService;
			return yield* Admin.set.deleteLog(id);
		},
		{ adminOnly: true }
	)
);
