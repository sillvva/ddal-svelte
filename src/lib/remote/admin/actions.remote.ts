import { adminRevokeSessionSchema, adminUserSchema, protectedUserReason } from "#lib/admin-user.js";
import { appLogId, type UserId } from "#lib/schemas.js";
import { guardedCommand } from "#lib/server/effect/guarded.js";
import { AppLog } from "#lib/server/effect/logging.js";
import { AdminService, ProtectedUserError } from "#lib/server/effect/services/admin.js";
import { AuthService } from "#lib/server/effect/services/auth.js";
import { requested } from "$app/server";
import { Effect } from "effect";
import * as v from "valibot";
import { getAppLogs, getUserDetail } from "./queries.remote";

export const deleteAppLog = guardedCommand(
	appLogId,
	function* (id) {
		const Admin = yield* AdminService;

		const result = yield* Admin.deleteLog(id);
		yield* Effect.promise(() => requested(getAppLogs, 1).refreshAll());

		return result;
	},
	"admin"
);

export const logClientError = guardedCommand(
	v.object({
		message: v.string(),
		status: v.optional(v.number()),
		name: v.optional(v.string()),
		stack: v.optional(v.string()),
		cause: v.optional(v.unknown()),
		boundary: v.optional(v.string())
	}),
	function* ({ message, name, stack, cause, boundary }) {
		yield* AppLog.error(message, { error: { name, stack, cause }, source: boundary ?? "client" });
	}
);

const assertRevocable = Effect.fn("AdminActions.assertRevocable")(function* (userId: UserId) {
	const Admin = yield* AdminService;
	const user = yield* Admin.get.user(userId);
	const reason = protectedUserReason(user, "revoke");
	if (reason) return yield* new ProtectedUserError(reason);
});

/** Revokes one session through better-auth. The client sends the session id, never the secret token. */
export const revokeUserSession = guardedCommand(
	adminRevokeSessionSchema,
	function* ({ userId, sessionId }, { event }) {
		const Auth = yield* AuthService;
		const Admin = yield* AdminService;

		yield* assertRevocable(userId);
		const session = yield* Admin.get.userSession(userId, sessionId);

		const result = yield* Effect.tryPromise(() =>
			Auth.api.revokeUserSession({
				body: { sessionToken: session.token },
				headers: event.request.headers
			})
		);
		yield* Effect.promise(() => getUserDetail(userId).refresh());

		return result.success;
	},
	"admin"
);

/** Revokes every session of the user through better-auth. */
export const revokeAllUserSessions = guardedCommand(
	adminUserSchema,
	function* ({ userId }, { event }) {
		const Auth = yield* AuthService;

		yield* assertRevocable(userId);

		const result = yield* Effect.tryPromise(() =>
			Auth.api.revokeUserSessions({
				body: { userId },
				headers: event.request.headers
			})
		);
		yield* Effect.promise(() => getUserDetail(userId).refresh());

		return result.success;
	},
	"admin"
);
