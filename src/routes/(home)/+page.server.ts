import { run } from "$server/effect";
import { redirect } from "@sveltejs/kit";

export const load = (event) =>
	run(function* () {
		const user = event.locals.user;

		const redirectTo = event.url.searchParams.get("redirect");
		if (user?.id) redirect(302, redirectTo || "/characters");

		return {
			redirectTo
		};
	});
