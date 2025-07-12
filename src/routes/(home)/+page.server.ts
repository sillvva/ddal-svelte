import { runOrThrow } from "$server/effect";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";

export const load = (event) =>
	runOrThrow(
		Effect.gen(function* () {
			const user = event.locals.user;

			const redirectTo = event.url.searchParams.get("redirect");
			if (user?.id) redirect(302, redirectTo || "/characters");

			return {
				redirectTo
			};
		})
	);
