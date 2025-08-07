import { assertAuthOrRedirect } from "$lib/server/auth";
import { runOrThrow } from "$lib/server/effect";
import { withLog } from "$lib/server/effect/logs.js";

export const load = (event) =>
	runOrThrow(function* () {
		const user = yield* assertAuthOrRedirect();

		const logs = yield* withLog((service) => service.get.dmLogs(user.id));

		return {
			logs,
			...event.params
		};
	});
