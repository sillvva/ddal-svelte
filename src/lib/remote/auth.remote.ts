import { command } from "$app/server";
import { imageUrlWithFallback, requiredString } from "$lib/schemas.js";
import { assertAuthOrFail } from "$lib/server/auth";
import { runOrReturn, type ErrorParams } from "$lib/server/effect";
import { withUser } from "$lib/server/effect/users";
import { Data, Effect } from "effect";
import * as v from "valibot";

class NoChangesError extends Data.TaggedError("NoChangesError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "No changes to update", status: 400, cause: err });
	}
}

class FailedError extends Data.TaggedError("FailedError")<ErrorParams> {
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
		runOrReturn(function* () {
			const user = yield* assertAuthOrFail();

			if (Object.keys(input).length === 0) return yield* Effect.fail(new NoChangesError());

			return yield* withUser((service) => service.set.update(user.id, input)).pipe(
				Effect.catchTag("DrizzleError", (err) => Effect.fail(new FailedError("update user", err)))
			);
		})
);
