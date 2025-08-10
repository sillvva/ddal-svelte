import { DMService } from "$lib/server/effect/dms";
import { authRedirect } from "$lib/server/effect/runtime.js";

export const load = (event) =>
	authRedirect(function* (user) {
		const DMs = yield* DMService;
		const dms = yield* DMs.get.userDMs(user.id);

		return {
			...event.params,
			dms
		};
	});
