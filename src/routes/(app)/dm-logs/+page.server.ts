import { runAuth } from "$lib/server/effect/runtime.js";
import { LogService } from "$lib/server/effect/services/logs";

export const load = (event) =>
	runAuth(function* (user) {
		const Logs = yield* LogService;
		const logs = yield* Logs.get.dmLogs(user.id);

		return {
			logs,
			...event.params
		};
	});
