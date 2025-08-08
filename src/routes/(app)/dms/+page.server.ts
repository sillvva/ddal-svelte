import { authRedirect } from "$lib/server/effect";
import { withDM } from "$lib/server/effect/dms";

export const load = (event) =>
	authRedirect(function* ({ user }) {
		const dms = yield* withDM((service) => service.get.userDMs(user.id));

		return {
			...event.params,
			dms
		};
	});
