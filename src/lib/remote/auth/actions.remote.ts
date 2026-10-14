import { imageUrlWithFallback, requiredString } from "#lib/schemas.js";
import { FailedError, type ErrorParams } from "#lib/server/effect/errors.js";
import { guardedCommand } from "#lib/server/effect/guarded.js";
import { AuthService } from "#lib/server/effect/services/auth.js";
import { Data, Effect } from "effect";
import * as v from "valibot";

class NoChangesError extends Data.TaggedError("NoChangesError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "No changes to update", status: 400, cause: err });
	}
}

const userFieldsSchema = v.partial(
	v.object({
		name: requiredString,
		email: requiredString,
		image: imageUrlWithFallback
	})
);

export const updateUser = guardedCommand(userFieldsSchema, function* (input, { user }) {
	const Auth = yield* AuthService;

	if (Object.keys(input).length === 0) return yield* Effect.fail(new NoChangesError());

	const result = yield* Auth.user
		.update(user.id, input)
		.pipe(Effect.catchTag("DrizzleError", (err) => Effect.fail(new FailedError("update user", err))));

	return result;
});
