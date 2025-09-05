import { command } from "$app/server";
import { imageUrlWithFallback, requiredString } from "$lib/schemas.js";
import { FailedError, type ErrorParams } from "$lib/server/effect/errors";
import { runSafe } from "$lib/server/effect/runtime";
import { assertAuth } from "$lib/server/effect/services/auth";
import { UserService } from "$lib/server/effect/services/users";
import { Data, Effect } from "effect";
import * as v from "valibot";

class NoChangesError extends Data.TaggedError("NoChangesError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "No changes to update", status: 400, cause: err });
	}
}

export const updateUser = command(
	v.partial(
		v.object({
			name: requiredString,
			email: requiredString,
			image: imageUrlWithFallback
		})
	),
	(input) =>
		runSafe(function* () {
			const { user } = yield* assertAuth();
			const Users = yield* UserService;

			if (Object.keys(input).length === 0) return yield* Effect.fail(new NoChangesError());

			const result = yield* Users.set
				.update(user.id, input)
				.pipe(Effect.catchTag("DrizzleError", (err) => Effect.fail(new FailedError("update user", err))));

			return result;
		})
);
