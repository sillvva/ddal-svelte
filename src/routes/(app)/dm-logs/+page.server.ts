import { run } from "$lib/server/effect/runtime.js";
import { assertAuth } from "$lib/server/effect/services/auth";
import { LogService } from "$lib/server/effect/services/logs";

export const load = (event) =>
	run(function* () {
		const { user } = yield* assertAuth();
		const Logs = yield* LogService;

		const logs = yield* Logs.get.dmLogs(user.id);

		return {
			logs,
			...event.params
		};
	});
