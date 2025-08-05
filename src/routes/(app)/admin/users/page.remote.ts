import { query } from "$app/server";
import { runOrThrow } from "$lib/server/effect";
import { withUser } from "$lib/server/effect/users";
import { Effect } from "effect";

export const getUsers = query(() =>
	runOrThrow(function* () {
		return yield* withUser((service) => service.get.users()).pipe(
			Effect.map((users) =>
				users.map((user) => ({
					...user,
					characters: user.characters.length
				}))
			)
		);
	})
);
