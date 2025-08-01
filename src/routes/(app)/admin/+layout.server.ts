import { assertAuth } from "$server/auth.js";
import { run } from "$server/effect";

export const load = async (event) =>
	run(function* () {
		const user = yield* assertAuth(event, true);

		return { user };
	});
