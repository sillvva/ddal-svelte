import { authRedirect } from "$lib/server/effect";
import { withLog } from "$lib/server/effect/logs.js";

export const load = (event) =>
	authRedirect(function* ({ user }) {
		const logs = yield* withLog((service) => service.get.dmLogs(user.id));

		return {
			logs,
			...event.params
		};
	});
