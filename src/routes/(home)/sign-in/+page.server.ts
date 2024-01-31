import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	await event.parent();
	const session = event.locals.session;
	const redirectTo = event.url.searchParams.get("redirect") || "/characters";
	const provider = event.cookies.get("authjs.provider") || "google";
	if (session?.user) redirect(302, redirectTo);
	return { provider };
};
