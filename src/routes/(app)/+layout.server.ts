import type { RouteId } from "$app/types";
import { assertAuthOrRedirect } from "$lib/server/auth.js";
import { runOrThrow } from "$lib/server/effect";

export const load = async (event) =>
	runOrThrow(function* () {
		const openRoutes: RouteId[] = ["/(app)/characters/[characterId]", "/(app)/characters/[characterId]/og-image.png"];
		if (!openRoutes.includes(event.route.id)) {
			yield* assertAuthOrRedirect();
		}
	});
