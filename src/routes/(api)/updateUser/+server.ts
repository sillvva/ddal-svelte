import type { UserId } from "$lib/schemas.js";
import type { User } from "$server/db/schema.js";
import { Log, run, type ErrorParams } from "$server/effect";
import { withUser } from "$server/effect/users";
import { json } from "@sveltejs/kit";
import { Data, Effect } from "effect";

export type UpdateUserResponse = User | { success: false; error: string };
export type UpdateUserInput = Partial<Pick<User, "name" | "email" | "image">> & { id: UserId };

class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Unauthorized", status: 401, cause: err });
	}
}

export const POST = async ({ request, locals }) =>
	run(
		Effect.fn("UpdateUser")(
			function* () {
				const user = locals.user;
				if (!user?.id) return yield* Effect.fail(new UnauthorizedError());

				let { id, ...rest } = (yield* Effect.promise(() => request.json())) as UpdateUserInput;

				const result = yield* withUser((service) => service.set.updateUser(id, rest));

				return result satisfies UpdateUserResponse;
			},
			(effect) =>
				effect.pipe(
					Effect.map((result) => json(result, { status: 200 })),
					Effect.tapError((e) => Log.error(`[UpdateUser] ${e.message}`, { status: e.status, cause: e.cause })),
					Effect.catchAll((e) =>
						Effect.succeed(json({ success: false, error: e.message } satisfies UpdateUserResponse, { status: e.status }))
					)
				)
		)
	);
