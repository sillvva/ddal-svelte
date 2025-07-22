import { assertUser } from "$server/auth";
import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const user = event.locals.user;
	assertUser(user);

	if (user.role !== "admin") throw redirect(302, "/characters");

	return { user };
};
