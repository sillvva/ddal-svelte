import { assertAuth } from "$lib/server/auth";
import { run } from "$lib/server/effect";
import { withLog } from "$lib/server/effect/logs.js";

export const load = (event) =>
	run(function* () {
		const user = yield* assertAuth();

		const logs = yield* withLog((service) => service.get.dmLogs(user.id));

		return {
			logs,
			...event.params
		};
	});
