import { run } from "$server/effect";
import { withUser } from "$server/effect/users";
import { Effect } from "effect";

export const load = async (event) =>
	run(function* () {
		const search = event.url.searchParams.get("s") ?? "";
		const users = yield* withUser((service) => service.get.users()).pipe(
			Effect.map((users) =>
				users.map((user) => ({
					...user,
					characters: user.characters.length
				}))
			)
		);

		return { users, search };
	});
