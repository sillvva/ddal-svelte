import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	await event.parent();
	const session = event.locals.session;
	const redirectTo = event.url.searchParams.get("redirect") || "/characters";
	if (session?.user) throw redirect(307, redirectTo);
};
