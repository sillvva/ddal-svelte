import { command } from "$app/server";
import { imageUrlWithFallback, requiredString } from "$lib/schemas.js";
import { ErrorFactory } from "$lib/server/effect/errors";
import { authReturn } from "$lib/server/effect/runtime";
import { UserService } from "$lib/server/effect/services/users";
import { Effect } from "effect";
import * as v from "valibot";

class NoChangesError extends ErrorFactory("NoChangesError") {
	constructor(err?: unknown) {
		super({ message: "No changes to update", status: 400, cause: err });
	}
}

class FailedError extends ErrorFactory("FailedError") {
	constructor(action: string, cause?: unknown) {
		super({ message: `Failed to ${action}`, status: 500, cause });
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
		authReturn(function* (user) {
			const Users = yield* UserService;

			if (Object.keys(input).length === 0) return yield* Effect.fail(new NoChangesError());

			const result = yield* Users.set
				.update(user.id, input)
				.pipe(Effect.catchTag("DrizzleError", (err) => Effect.fail(new FailedError("update user", err))));

			return result;
		})
);
