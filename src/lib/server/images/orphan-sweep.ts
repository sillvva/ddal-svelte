import { chunkKeys, ORPHAN_DELETE_BATCH_SIZE, ORPHAN_DRY_RUN_TTL_MS } from "#lib/admin-storage.js";
import { isPermanentImageKey, TEMPORARY_IMAGE_PREFIX } from "#lib/images/object-key.js";
import { Effect } from "effect";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const FUTURE_CLOCK_SKEW_MS = 60_000;

export interface OrphanSweepTokenPayload {
	bucket: string;
	userId: string;
	issuedAt: number;
	keys: readonly string[];
}

export interface OrphanDeletionError {
	key: string;
	code: string;
	message: string;
}

export interface OrphanDeletionResult {
	requestedCount: number;
	deletedCount: number;
	skippedCount: number;
	failedCount: number;
	deletedKeys: string[];
	skippedKeys: string[];
	errors: OrphanDeletionError[];
}

export interface OrphanDeletionOps<E = never, R = never> {
	/** Returns the subset of `keys` that are currently referenced in the database. */
	findReferenced: (keys: readonly string[]) => Effect.Effect<ReadonlySet<string>, E, R>;
	/** Deletes up to {@link ORPHAN_DELETE_BATCH_SIZE} keys in a single `DeleteObjects` call. */
	deleteBatch: (keys: readonly string[]) => Effect.Effect<{ deletedKeys: string[]; errors: OrphanDeletionError[] }, E, R>;
}

function compareKeys(a: string, b: string) {
	return a < b ? -1 : a > b ? 1 : 0;
}

function hashKeyList(sortedKeys: readonly string[]) {
	return createHash("sha256").update(JSON.stringify(sortedKeys)).digest("hex");
}

function signPayload(bucket: string, userId: string, issuedAt: number, keysHash: string, secret: string) {
	return createHmac("sha256", secret)
		.update(JSON.stringify(["admin-orphan-sweep-v1", bucket, userId, issuedAt, keysHash]))
		.digest("hex");
}

/**
 * Produces an HMAC token binding a dry-run key list to the bucket, admin user, and scan timestamp.
 * Only keys that match this signed dry run can be deleted on confirmation.
 */
export function createOrphanSweepToken(payload: OrphanSweepTokenPayload, secret: string): string {
	const sortedUnique = [...new Set(payload.keys)].sort(compareKeys);
	return signPayload(payload.bucket, payload.userId, payload.issuedAt, hashKeyList(sortedUnique), secret);
}

export type OrphanTokenVerification = { ok: true; keys: string[] } | { ok: false; reason: string };

/**
 * Verifies that a confirmation request carries an unmodified, unexpired dry-run key list
 * issued for the same bucket and admin user, and containing only permanent image keys.
 */
export function verifyOrphanSweepToken(
	input: OrphanSweepTokenPayload & { token: string },
	secret: string,
	options?: { now?: number; ttlMs?: number }
): OrphanTokenVerification {
	if (!input.keys.length) return { ok: false, reason: "Dry run contains no keys." };

	const unique = new Set<string>();
	for (const key of input.keys) {
		if (key.startsWith(TEMPORARY_IMAGE_PREFIX) || !isPermanentImageKey(key)) {
			return { ok: false, reason: "Dry run contains a key outside permanent image storage." };
		}
		if (unique.has(key)) {
			return { ok: false, reason: "Dry run contains duplicate keys." };
		}
		unique.add(key);
	}

	const now = options?.now ?? Date.now();
	const ttlMs = options?.ttlMs ?? ORPHAN_DRY_RUN_TTL_MS;
	if (!Number.isFinite(input.issuedAt) || input.issuedAt > now + FUTURE_CLOCK_SKEW_MS) {
		return { ok: false, reason: "Dry run timestamp is invalid." };
	}
	if (now - input.issuedAt > ttlMs) {
		return { ok: false, reason: "Dry run has expired. Run a new dry run before deleting." };
	}

	const sorted = [...unique].sort(compareKeys);
	const expectedHex = signPayload(input.bucket, input.userId, input.issuedAt, hashKeyList(sorted), secret);

	if (!/^[0-9a-f]{64}$/iu.test(input.token)) {
		return { ok: false, reason: "Dry run token is invalid." };
	}

	const expected = Buffer.from(expectedHex, "hex");
	const actual = Buffer.from(input.token, "hex");
	if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
		return { ok: false, reason: "Dry run token does not match the listed keys." };
	}

	return { ok: true, keys: sorted };
}

/**
 * Deletes confirmed orphan keys in batches of at most `batchSize` (default 1000).
 * Right before each batch, re-checks which keys are still unreferenced and skips any
 * key that became referenced since the dry run (or any non-permanent/`tmp/` key).
 */
export function executeOrphanDeletion<E, R>(
	keys: readonly string[],
	ops: OrphanDeletionOps<E, R>,
	batchSize = ORPHAN_DELETE_BATCH_SIZE
): Effect.Effect<OrphanDeletionResult, E, R> {
	return Effect.gen(function* () {
		const candidateKeys: string[] = [];
		const skippedKeys: string[] = [];
		const seen = new Set<string>();

		for (const key of keys) {
			if (seen.has(key)) continue;
			seen.add(key);
			if (key.startsWith(TEMPORARY_IMAGE_PREFIX) || !isPermanentImageKey(key)) {
				skippedKeys.push(key);
				continue;
			}
			candidateKeys.push(key);
		}

		const deletedKeys: string[] = [];
		const errors: OrphanDeletionError[] = [];

		for (const batch of chunkKeys(candidateKeys, batchSize)) {
			const referenced = yield* ops.findReferenced(batch);
			const safeToDelete: string[] = [];

			for (const key of batch) {
				if (referenced.has(key)) {
					skippedKeys.push(key);
				} else {
					safeToDelete.push(key);
				}
			}

			if (!safeToDelete.length) continue;

			const batchResult = yield* ops.deleteBatch(safeToDelete);
			deletedKeys.push(...batchResult.deletedKeys);
			errors.push(...batchResult.errors);
		}

		return {
			requestedCount: seen.size,
			deletedCount: deletedKeys.length,
			skippedCount: skippedKeys.length,
			failedCount: errors.length,
			deletedKeys,
			skippedKeys,
			errors
		};
	});
}
