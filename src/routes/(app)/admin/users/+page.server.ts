import { assertUser } from "$server/auth.js";
import { run } from "$server/effect";
import { withUser } from "$server/effect/users";
import { Effect } from "effect";

export const load = async (event) => {
	const user = event.locals.user;
	assertUser(user);

	const users = await run(
		withUser((service) => service.get.users(user.id)).pipe(
			Effect.map((users) => users.map((user) => ({ ...user, isBanned: user.banned, banned: user.banned ? "Yes" : "No" })))
		)
	);

	return { users };
};
