import { v7 } from "uuid";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
	adminDeleteUserSchema,
	adminRevokeSessionSchema,
	adminUserSchema,
	deleteConfirmationSegment,
	matchesDeleteConfirmation,
	protectedUserReason,
	summarizeSessions
} from "./admin-user";

const userId = "018f3c1e-7a2b-7c3d-8e4f-0123456789ab";

describe("deleteConfirmationSegment", () => {
	it("is the last dash-separated segment of the id", () => {
		expect(deleteConfirmationSegment(userId)).toBe("0123456789ab");
	});

	it("is the whole value when there is no dash", () => {
		expect(deleteConfirmationSegment("abc")).toBe("abc");
	});
});

describe("matchesDeleteConfirmation", () => {
	it("accepts the segment regardless of case and surrounding whitespace", () => {
		expect(matchesDeleteConfirmation(userId, "0123456789ab")).toBe(true);
		expect(matchesDeleteConfirmation(userId, "  0123456789AB \n")).toBe(true);
	});

	it("rejects empty, partial and wrong input", () => {
		expect(matchesDeleteConfirmation(userId, "")).toBe(false);
		expect(matchesDeleteConfirmation(userId, "   ")).toBe(false);
		expect(matchesDeleteConfirmation(userId, "0123456789a")).toBe(false);
		expect(matchesDeleteConfirmation(userId, userId)).toBe(false);
		expect(matchesDeleteConfirmation(userId, "ffffffffffff")).toBe(false);
	});

	it("never matches when the id has no segment", () => {
		expect(matchesDeleteConfirmation("", "")).toBe(false);
	});
});

describe("protectedUserReason", () => {
	it("refuses to delete admins", () => {
		expect(protectedUserReason({ role: "admin" })).toBe("Cannot delete admin accounts");
		expect(protectedUserReason({ role: "admin" }, "delete")).toBe("Cannot delete admin accounts");
	});

	it("refuses to revoke admin sessions", () => {
		expect(protectedUserReason({ role: "admin" }, "revoke")).toBe("Cannot revoke sessions of admin accounts");
	});

	it("allows regular users", () => {
		expect(protectedUserReason({ role: "user" })).toBeNull();
		expect(protectedUserReason({ role: "user" }, "revoke")).toBeNull();
	});
});

describe("summarizeSessions", () => {
	const now = new Date("2026-01-10T12:00:00Z");
	const session = (id: string, createdAt: string, expiresAt: string) => ({
		id,
		createdAt: new Date(createdAt),
		expiresAt: new Date(expiresAt)
	});

	it("keeps only unexpired sessions, newest first", () => {
		const { active } = summarizeSessions(
			[
				session("old", "2026-01-01T00:00:00Z", "2026-01-31T00:00:00Z"),
				session("expired", "2025-11-01T00:00:00Z", "2025-12-01T00:00:00Z"),
				session("new", "2026-01-09T00:00:00Z", "2026-02-08T00:00:00Z")
			],
			now
		);
		expect(active.map((s) => s.id)).toEqual(["new", "old"]);
	});

	it("treats a session that expires exactly now as expired", () => {
		const { active } = summarizeSessions([session("edge", "2026-01-01T00:00:00Z", "2026-01-10T12:00:00Z")], now);
		expect(active).toEqual([]);
	});

	it("counts expired sessions toward the last session time", () => {
		const { active, lastSessionAt } = summarizeSessions(
			[session("expired", "2025-11-01T00:00:00Z", "2025-12-01T00:00:00Z")],
			now
		);
		expect(active).toEqual([]);
		expect(lastSessionAt).toEqual(new Date("2025-11-01T00:00:00Z"));
	});

	it("has no last session without sessions", () => {
		expect(summarizeSessions([], now)).toEqual({ active: [], lastSessionAt: null });
	});

	it("does not reorder the input", () => {
		const input = [
			session("a", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z"),
			session("b", "2026-01-05T00:00:00Z", "2026-02-05T00:00:00Z")
		];
		summarizeSessions(input, now);
		expect(input.map((s) => s.id)).toEqual(["a", "b"]);
	});
});

describe("admin input schemas", () => {
	it("requires a UUIDv7 user id", () => {
		expect(v.safeParse(adminUserSchema, { userId: v7() }).success).toBe(true);
		expect(v.safeParse(adminUserSchema, { userId: "not-a-uuid" }).success).toBe(false);
		expect(v.safeParse(adminUserSchema, { userId: "00000000-0000-4000-8000-000000000000" }).success).toBe(false);
		expect(v.safeParse(adminUserSchema, {}).success).toBe(false);
	});

	it("takes a session id rather than a token when revoking one session", () => {
		expect(v.safeParse(adminRevokeSessionSchema, { userId: v7(), sessionId: v7() }).success).toBe(true);
		expect(v.safeParse(adminRevokeSessionSchema, { userId: v7(), sessionId: "token-abc" }).success).toBe(false);
		expect(v.safeParse(adminRevokeSessionSchema, { userId: v7() }).success).toBe(false);
	});

	it("takes a user id and a confirmation to delete", () => {
		expect(v.safeParse(adminDeleteUserSchema, { userId: v7(), confirmation: "abc" }).success).toBe(true);
		expect(v.safeParse(adminDeleteUserSchema, { userId: v7() }).success).toBe(false);
		expect(v.safeParse(adminDeleteUserSchema, { userId: "x", confirmation: "abc" }).success).toBe(false);
	});
});
