import { run } from "$lib/server/effect/runtime.js";
import { assertAuth } from "$lib/server/effect/services/auth";
import { DMService } from "$lib/server/effect/services/dms";

export const load = (event) =>
	run(function* () {
		const { user } = yield* assertAuth();

		const DMs = yield* DMService;
		const dms = yield* DMs.get.userDMs(user);

		return {
			...event.params,
			dms
		};
	});
