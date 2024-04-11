import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const session = event.locals.session;

	const redirectTo = event.url.searchParams.get("redirect");
	if (session?.user?.id) redirect(302, redirectTo || "/characters");

	return {
		redirectTo
	};
};
