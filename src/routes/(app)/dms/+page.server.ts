import { runAuth } from "$lib/server/effect/runtime.js";
import { DMService } from "$lib/server/effect/services/dms";

export const load = (event) =>
	runAuth(function* (user) {
		const DMs = yield* DMService;
		const dms = yield* DMs.get.userDMs(user.id);

		return {
			...event.params,
			dms
		};
	});
