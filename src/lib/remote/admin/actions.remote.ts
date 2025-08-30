import { command } from "$app/server";
import { appLogId, requiredString, userIdSchema } from "$lib/schemas";
import { FailedError } from "$lib/server/effect/errors";
import { runAuthSafe } from "$lib/server/effect/runtime";
import { AdminService } from "$lib/server/effect/services/admin";
import { AuthService } from "$lib/server/effect/services/auth";
import { Effect } from "effect";
import * as v from "valibot";
import { getUsers } from "./queries.remote";

export const deleteAppLog = command(appLogId, (id) =>
	runAuthSafe(
		function* () {
			const Admin = yield* AdminService;
			return yield* Admin.set.deleteLog(id);
		},
		{ adminOnly: true }
	)
);

export const banUser = command(
	v.object({
		userId: userIdSchema,
		banReason: requiredString
	}),
	({ userId, banReason }) =>
		runAuthSafe(
			function* (_, event) {
				const Auth = yield* AuthService;

				const auth = yield* Auth.auth();
				const result = yield* Effect.tryPromise({
					try: () =>
						auth.api.banUser({
							body: { userId, banReason },
							headers: event.request.headers
						}),
					catch: (err) => new FailedError("ban user", err)
				});

				yield* Effect.promise(() => getUsers().refresh());

				return result;
			},
			{ adminOnly: true }
		)
);

export const unbanUser = command(userIdSchema, (userId) =>
	runAuthSafe(
		function* (_, event) {
			const Auth = yield* AuthService;

			const auth = yield* Auth.auth();
			const result = yield* Effect.tryPromise({
				try: () =>
					auth.api.unbanUser({
						body: { userId },
						headers: event.request.headers
					}),
				catch: (err) => new FailedError("unban user", err)
			});

			yield* Effect.promise(() => getUsers().refresh());

			return result;
		},
		{ adminOnly: true }
	)
);
