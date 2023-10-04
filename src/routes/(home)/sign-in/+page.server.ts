import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const parent = await event.parent();
	const session = event.locals.session;
	const redirectTo = event.url.searchParams.get("redirect") || "/characters";
	if (session?.user) throw redirect(301, redirectTo);
};
