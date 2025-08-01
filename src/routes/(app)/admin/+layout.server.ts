import { assertAuth } from "$lib/server/auth.js";
import { run } from "$lib/server/effect";

export const load = async (event) =>
	run(function* () {
		yield* assertAuth(true);
	});
