import { userIdSchema } from "#lib/schemas.js";
import * as v from "valibot";

/** The last segment of a user id. The admin types it to confirm a deletion, like self-serve account deletion. */
export function deleteConfirmationSegment(userId: string) {
	return userId.split("-").at(-1) ?? "";
}

/** Case-insensitive, whitespace-trimmed match against the last segment of the user id. */
export function matchesDeleteConfirmation(userId: string, confirmation: string) {
	const segment = deleteConfirmationSegment(userId);
	return segment.length > 0 && confirmation.trim().toLowerCase() === segment.toLowerCase();
}

/** Why an account cannot be changed from the admin user page, or `null` when it can. */
export function protectedUserReason(user: { role: string }, action: "delete" | "revoke" = "delete") {
	if (user.role !== "admin") return null;
	return action === "delete" ? "Cannot delete admin accounts" : "Cannot revoke sessions of admin accounts";
}

export const adminUserSchema = v.object({ userId: userIdSchema });

export const adminRevokeSessionSchema = v.object({
	userId: userIdSchema,
	sessionId: v.pipe(v.string(), v.uuid())
});

export const adminDeleteUserSchema = v.object({
	userId: userIdSchema,
	confirmation: v.string()
});

export interface UserSessionRow {
	id: string;
	ipAddress: string | null;
	userAgent: string | null;
	expiresAt: Date;
	createdAt: Date;
	impersonatedBy: string | null;
}

/**
 * Splits a user's sessions into the ones still valid at `now`, newest first, and the time the latest session
 * started. Expired rows linger until the daily cleanup job, so `lastSessionAt` counts them.
 */
export function summarizeSessions<T extends Pick<UserSessionRow, "expiresAt" | "createdAt">>(sessions: readonly T[], now: Date) {
	const byNewest = [...sessions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	return {
		active: byNewest.filter((session) => session.expiresAt.getTime() > now.getTime()),
		lastSessionAt: byNewest[0]?.createdAt ?? null
	};
}
