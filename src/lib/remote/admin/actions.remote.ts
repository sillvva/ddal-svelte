import { appLogId, requiredString, userIdSchema } from "$lib/schemas";
import { FailedError } from "$lib/server/effect/errors";
import { guardedCommand } from "$lib/server/effect/remote";
import { AdminService } from "$lib/server/effect/services/admin";
import { AuthService } from "$lib/server/effect/services/auth";
import { Effect } from "effect";
import * as v from "valibot";
import { getUsers } from "./queries.remote";

export const deleteAppLog = guardedCommand(
	appLogId,
	function* (id) {
		const Admin = yield* AdminService;
		return yield* Admin.set.deleteLog(id);
	},
	true
);

const banUserSchema = v.object({
	userId: userIdSchema,
	banReason: requiredString
});

export const banUser = guardedCommand(
	banUserSchema,
	function* ({ userId, banReason }, { event }) {
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
	true
);

export const unbanUser = guardedCommand(
	userIdSchema,
	function* (userId, { event }) {
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
	true
);
