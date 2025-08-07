import { assertAuthOrRedirect } from "$lib/server/auth.js";
import { runOrThrow } from "$lib/server/effect";

export const load = async () =>
	runOrThrow(function* () {
		yield* assertAuthOrRedirect(true);
	});
