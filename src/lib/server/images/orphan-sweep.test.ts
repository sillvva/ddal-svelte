import {
	permanentAvatarImageKey,
	permanentCharacterImageKey,
	permanentNoteImageKey,
	temporaryCharacterImageKey
} from "#lib/images/object-key.js";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createOrphanSweepToken, executeOrphanDeletion, verifyOrphanSweepToken, type OrphanDeletionError } from "./orphan-sweep";

const SECRET = "test-auth-secret-value-12345";
const BUCKET = "ddal-uploads";
const ADMIN_ID = "018f3c1e-7a2b-7c3d-8e4f-012345678900";
const OTHER_ADMIN_ID = "018f3c1e-7a2b-7c3d-8e4f-012345678901";
const USER_A = "018f3c1e-7a2b-7c3d-8e4f-0123456789aa";
const CHAR_A = "018f3c1e-7a2b-7c3d-8e4f-0123456789cc";

function makePermanentKey(index: number) {
	const hex = index.toString(16).padStart(12, "0");
	const uploadId = `019a0000-0000-7000-8000-${hex}`;
	return permanentCharacterImageKey(USER_A, CHAR_A, uploadId, "image/webp");
}

const KEY_1 = makePermanentKey(1);
const KEY_2 = permanentAvatarImageKey(USER_A, "019a0000-0000-7000-8000-000000000002", "image/jpeg");
const KEY_3 = permanentNoteImageKey(USER_A, "019a0000-0000-7000-8000-000000000003", "image/webp");
const TMP_KEY = temporaryCharacterImageKey(USER_A, CHAR_A, "019a0000-0000-7000-8000-000000000004", "image/webp");

describe("orphan sweep HMAC token", () => {
	const issuedAt = 1_700_000_000_000;

	it("accepts an unmodified dry-run payload within TTL", () => {
		const keys = [KEY_1, KEY_2];
		const token = createOrphanSweepToken({ bucket: BUCKET, userId: ADMIN_ID, issuedAt, keys }, SECRET);

		const result = verifyOrphanSweepToken({ bucket: BUCKET, userId: ADMIN_ID, issuedAt, keys, token }, SECRET, {
			now: issuedAt + 60_000
		});
		expect(result).toEqual({ ok: true, keys: [...keys].sort() });
	});

	it("rejects added, removed, or substituted keys", () => {
		const token = createOrphanSweepToken({ bucket: BUCKET, userId: ADMIN_ID, issuedAt, keys: [KEY_1, KEY_2] }, SECRET);

		expect(
			verifyOrphanSweepToken({ bucket: BUCKET, userId: ADMIN_ID, issuedAt, keys: [KEY_1, KEY_2, KEY_3], token }, SECRET, {
				now: issuedAt + 1000
			}).ok
		).toBe(false);

		expect(
			verifyOrphanSweepToken({ bucket: BUCKET, userId: ADMIN_ID, issuedAt, keys: [KEY_1], token }, SECRET, {
				now: issuedAt + 1000
			}).ok
		).toBe(false);

		expect(
			verifyOrphanSweepToken({ bucket: BUCKET, userId: ADMIN_ID, issuedAt, keys: [KEY_1, KEY_3], token }, SECRET, {
				now: issuedAt + 1000
			}).ok
		).toBe(false);
	});

	it("rejects wrong bucket, wrong admin user, wrong secret, or expired token", () => {
		const keys = [KEY_1];
		const token = createOrphanSweepToken({ bucket: BUCKET, userId: ADMIN_ID, issuedAt, keys }, SECRET);

		expect(
			verifyOrphanSweepToken({ bucket: "ddal-uploads-dev", userId: ADMIN_ID, issuedAt, keys, token }, SECRET, {
				now: issuedAt + 1000
			}).ok
		).toBe(false);

		expect(
			verifyOrphanSweepToken({ bucket: BUCKET, userId: OTHER_ADMIN_ID, issuedAt, keys, token }, SECRET, {
				now: issuedAt + 1000
			}).ok
		).toBe(false);

		expect(
			verifyOrphanSweepToken({ bucket: BUCKET, userId: ADMIN_ID, issuedAt, keys, token }, "wrong-secret", {
				now: issuedAt + 1000
			}).ok
		).toBe(false);

		expect(
			verifyOrphanSweepToken({ bucket: BUCKET, userId: ADMIN_ID, issuedAt, keys, token }, SECRET, {
				now: issuedAt + 20 * 60 * 1000,
				ttlMs: 15 * 60 * 1000
			}).ok
		).toBe(false);
	});

	it("rejects tmp/, non-permanent, empty, and duplicate keys even if signed", () => {
		const tmpToken = createOrphanSweepToken({ bucket: BUCKET, userId: ADMIN_ID, issuedAt, keys: [TMP_KEY] }, SECRET);
		expect(
			verifyOrphanSweepToken({ bucket: BUCKET, userId: ADMIN_ID, issuedAt, keys: [TMP_KEY], token: tmpToken }, SECRET, {
				now: issuedAt + 1000
			}).ok
		).toBe(false);

		const dupToken = createOrphanSweepToken({ bucket: BUCKET, userId: ADMIN_ID, issuedAt, keys: [KEY_1] }, SECRET);
		expect(
			verifyOrphanSweepToken({ bucket: BUCKET, userId: ADMIN_ID, issuedAt, keys: [KEY_1, KEY_1], token: dupToken }, SECRET, {
				now: issuedAt + 1000
			}).ok
		).toBe(false);

		expect(
			verifyOrphanSweepToken({ bucket: BUCKET, userId: ADMIN_ID, issuedAt, keys: [], token: dupToken }, SECRET, {
				now: issuedAt + 1000
			}).ok
		).toBe(false);
	});
});

describe("executeOrphanDeletion", () => {
	it("re-checks each batch right before deleting and skips newly referenced or tmp/ keys", async () => {
		const checkedBatches: string[][] = [];
		const deletedBatches: string[][] = [];

		const result = await Effect.runPromise(
			executeOrphanDeletion([KEY_1, KEY_2, KEY_3, TMP_KEY, "other/file.txt"], {
				findReferenced: (batch) => {
					checkedBatches.push([...batch]);
					// Simulate KEY_2 becoming referenced between dry run and confirm.
					return Effect.succeed(new Set([KEY_2]));
				},
				deleteBatch: (batch) => {
					deletedBatches.push([...batch]);
					return Effect.succeed({ deletedKeys: [...batch], errors: [] });
				}
			})
		);

		expect(checkedBatches).toEqual([[KEY_1, KEY_2, KEY_3]]);
		expect(deletedBatches).toEqual([[KEY_1, KEY_3]]);
		expect(result).toEqual({
			requestedCount: 5,
			deletedCount: 2,
			skippedCount: 3,
			failedCount: 0,
			deletedKeys: [KEY_1, KEY_3],
			skippedKeys: [TMP_KEY, "other/file.txt", KEY_2],
			errors: []
		});
	});

	it("skips calling deleteBatch when every key in a batch became referenced", async () => {
		let deleteCalls = 0;

		const result = await Effect.runPromise(
			executeOrphanDeletion([KEY_1, KEY_2], {
				findReferenced: () => Effect.succeed(new Set([KEY_1, KEY_2])),
				deleteBatch: () => {
					deleteCalls += 1;
					return Effect.succeed({ deletedKeys: [], errors: [] });
				}
			})
		);

		expect(deleteCalls).toBe(0);
		expect(result.deletedCount).toBe(0);
		expect(result.skippedCount).toBe(2);
		expect(result.skippedKeys).toEqual([KEY_1, KEY_2]);
	});

	it("splits more than 1000 keys into batches of at most 1000 and re-checks before each batch", async () => {
		const keys = Array.from({ length: 2503 }, (_, i) => makePermanentKey(i + 1));
		const checkedSizes: number[] = [];
		const deletedSizes: number[] = [];

		const result = await Effect.runPromise(
			executeOrphanDeletion(keys, {
				findReferenced: (batch) => {
					checkedSizes.push(batch.length);
					// Skip 1 key from the second batch to verify per-batch filtering.
					return Effect.succeed(batch.includes(keys[1200]!) ? new Set([keys[1200]!]) : new Set());
				},
				deleteBatch: (batch) => {
					deletedSizes.push(batch.length);
					return Effect.succeed({ deletedKeys: [...batch], errors: [] });
				}
			})
		);

		expect(checkedSizes).toEqual([1000, 1000, 503]);
		expect(deletedSizes).toEqual([1000, 999, 503]);
		expect(Math.max(...deletedSizes)).toBeLessThanOrEqual(1000);
		expect(result.requestedCount).toBe(2503);
		expect(result.deletedCount).toBe(2502);
		expect(result.skippedCount).toBe(1);
		expect(result.failedCount).toBe(0);
	});

	it("records partial DeleteObjects errors without losing deleted counts", async () => {
		const errors: OrphanDeletionError[] = [{ key: KEY_2, code: "AccessDenied", message: "Denied" }];

		const result = await Effect.runPromise(
			executeOrphanDeletion([KEY_1, KEY_2], {
				findReferenced: () => Effect.succeed(new Set()),
				deleteBatch: () => Effect.succeed({ deletedKeys: [KEY_1], errors })
			})
		);

		expect(result.deletedCount).toBe(1);
		expect(result.deletedKeys).toEqual([KEY_1]);
		expect(result.failedCount).toBe(1);
		expect(result.errors).toEqual(errors);
	});
});
