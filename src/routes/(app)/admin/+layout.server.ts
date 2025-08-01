import { assertAuth } from "$server/auth.js";
import { run } from "$server/effect";

export const load = async (event) =>
	run(function* () {
		yield* assertAuth(event, true);
	});
