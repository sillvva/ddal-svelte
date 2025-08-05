import { getError } from "$lib/server/auth";
import { runOrThrow } from "$lib/server/effect";
import { redirect } from "@sveltejs/kit";

export const load = (event) =>
	runOrThrow(function* () {
		const user = event.locals.user;

		const redirectTo = event.url.searchParams.get("redirect");
		if (user?.id) redirect(307, redirectTo || "/characters");

		const code = event.url.searchParams.get("code");
		const reason = event.url.searchParams.get("reason");
		const error = getError(code, reason);

		return {
			redirectTo,
			error
		};
	});
