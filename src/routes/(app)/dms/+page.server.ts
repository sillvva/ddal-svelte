import { assertAuth } from "$lib/server/auth";
import { run } from "$lib/server/effect";
import { withDM } from "$lib/server/effect/dms";

export const load = (event) =>
	run(function* () {
		const user = yield* assertAuth();

		const dms = yield* withDM((service) => service.get.userDMs(user.id));

		return {
			...event.params,
			dms
		};
	});
