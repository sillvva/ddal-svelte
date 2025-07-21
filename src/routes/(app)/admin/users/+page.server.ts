import { assertUser } from "$server/auth.js";
import { run } from "$server/effect";
import { withUser } from "$server/effect/users";

export const load = async (event) => {
	const user = event.locals.user;
	assertUser(user);

	const users = await run(withUser((service) => service.get.users(user.id)));

	return { users };
};
