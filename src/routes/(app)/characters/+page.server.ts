import { assertUser } from "$server/auth";
import { runOrThrow } from "$server/effect";
import { withCharacter } from "$server/effect/characters.js";
import { Effect } from "effect";

export const load = (event) =>
	runOrThrow(
		Effect.gen(function* () {
			const user = event.locals.user;
			assertUser(user);

			const characters = yield* withCharacter((service) => service.getUserCharacters(user.id, true));

			return {
				title: `${user.name}'s Characters`,
				characters
			};
		})
	);
