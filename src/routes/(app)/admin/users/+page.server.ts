import { assertAuth } from "$server/auth";
import { run } from "$server/effect";
import { withUser } from "$server/effect/users";
import { Effect } from "effect";

export const load = async (event) =>
	run(function* () {
		const user = yield* assertAuth(event, true);

		const search = event.url.searchParams.get("s") ?? "";
		const users = yield* withUser((service) => service.get.users(user.id)).pipe(
			Effect.map((users) =>
				users.map((user) => ({
					...user,
					characters: user.characters.length,
					isBanned: user.banned,
					banned: user.banned ? "Yes" : "No"
				}))
			)
		);

		return { users, search };
	});
