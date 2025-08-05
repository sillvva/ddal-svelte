import { assertAuth } from "$lib/server/auth";
import { runOrThrow } from "$lib/server/effect";
import { withDM } from "$lib/server/effect/dms";

export const load = (event) =>
	runOrThrow(function* () {
		const user = yield* assertAuth();

		const dms = yield* withDM((service) => service.get.userDMs(user.id));

		return {
			...event.params,
			dms
		};
	});
