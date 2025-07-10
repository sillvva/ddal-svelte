import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const user = event.locals.user;

	const redirectTo = event.url.searchParams.get("redirect");
	if (user?.id) redirect(302, redirectTo || "/characters");

	return {
		redirectTo
	};
};
