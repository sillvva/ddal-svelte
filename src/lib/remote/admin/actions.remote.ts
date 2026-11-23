import { deleteOrphanedObjectsSchema, pendingDeletionKeySchema } from "#lib/admin-storage.js";
import { adminRevokeSessionSchema, adminUserSchema, protectedUserReason } from "#lib/admin-user.js";
import { appLogId, type UserId } from "#lib/schemas.js";
import { guardedCommand } from "#lib/server/effect/guarded.js";
import { AppLog } from "#lib/server/effect/logging.js";
import { AdminService, ProtectedUserError } from "#lib/server/effect/services/admin.js";
import { AuthService } from "#lib/server/effect/services/auth.js";
import { StorageService } from "#lib/server/effect/services/storage.js";
import { requested } from "$app/server";
import { Effect } from "effect";
import * as v from "valibot";
import { getAppLogs, getPendingDeletions, getUserDetail } from "./queries.remote";

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

/** Runs `StorageService.purgePending` against all queued rows in `pending_object_deletion`. */
export const purgePendingDeletions = guardedCommand(
	v.void(),
	function* () {
		const Storage = yield* StorageService;

		const beforeQueue = yield* Storage.getPendingDeletionQueue();
		yield* Storage.purgePending();
		const afterQueue = yield* Storage.getPendingDeletionQueue();

		const before = beforeQueue.items.length;
		const remaining = afterQueue.items.length;
		const purged = Math.max(0, before - remaining);

		yield* AppLog.info("AdminActions.purgePendingDeletions", {
			bucket: afterQueue.bucket,
			before,
			remaining,
			purged
		});
		yield* Effect.promise(() => getPendingDeletions().refresh());

		return { before, remaining, purged };
	},
	"admin"
);

/** Retries deleting a single queued row from `pending_object_deletion`. */
export const retryPendingDeletion = guardedCommand(
	pendingDeletionKeySchema,
	function* ({ objectKey }) {
		const Storage = yield* StorageService;

		const outcome = yield* Storage.retryPendingDeletion(objectKey);
		yield* Effect.promise(() => getPendingDeletions().refresh());

		return outcome;
	},
	"admin"
);

/** Drops a stuck row from `pending_object_deletion` without deleting its R2 object. */
export const removePendingDeletion = guardedCommand(
	pendingDeletionKeySchema,
	function* ({ objectKey }) {
		const Storage = yield* StorageService;

		const result = yield* Storage.removePendingDeletion(objectKey);
		yield* Effect.promise(() => getPendingDeletions().refresh());

		return result;
	},
	"admin"
);

/** Dry-run scan for orphaned permanent objects in `R2_BUCKET`. Never deletes objects. */
export const scanOrphanedObjects = guardedCommand(
	v.void(),
	function* (_input, { user }) {
		const Storage = yield* StorageService;
		return yield* Storage.scanOrphanedObjects(user.id);
	},
	"admin"
);

/** Deletes orphaned permanent objects from a confirmed dry run after server-side re-verification. */
export const deleteOrphanedObjects = guardedCommand(
	deleteOrphanedObjectsSchema,
	function* (input, { user }) {
		const Storage = yield* StorageService;
		return yield* Storage.deleteOrphanedObjects(user.id, input);
	},
	"admin"
);
