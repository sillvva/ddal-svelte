import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	await event.parent();
	const session = event.locals.session;
	if (session?.user) throw redirect(307, "/characters");
};
