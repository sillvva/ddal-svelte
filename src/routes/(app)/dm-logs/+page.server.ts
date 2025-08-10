import { LogService } from "$lib/server/effect/logs";
import { authRedirect } from "$lib/server/effect/runtime.js";

export const load = (event) =>
	authRedirect(function* (user) {
		const Logs = yield* LogService;
		const logs = yield* Logs.get.dmLogs(user.id);

		return {
			logs,
			...event.params
		};
	});
