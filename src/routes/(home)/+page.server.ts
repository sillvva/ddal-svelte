import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const parent = await event.parent();
	const session = event.locals.session;
	if (session?.user) throw redirect(301, "/characters");
};
