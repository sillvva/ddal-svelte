import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const parent = await event.parent();
	const session = parent.session;
	if (session?.user) throw redirect(301, "/characters");
};
