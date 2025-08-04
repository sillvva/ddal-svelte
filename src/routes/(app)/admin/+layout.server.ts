import { assertAuth } from "$lib/server/auth.js";
import { run } from "$lib/server/effect";

export const load = async () =>
	run(function* () {
		yield* assertAuth(true);
	});
