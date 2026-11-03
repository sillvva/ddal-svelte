import { formatStorageBytes, IMAGE_STORAGE_LIMITS } from "#lib/images/limits.js";
import type { CharacterId, LogId, UserId } from "#lib/schemas.js";
import { runQuery, type Database, type Transaction } from "#lib/server/db/index.js";
import { characters, user } from "#lib/server/db/schema.js";
import { ImageUploadError } from "#lib/server/images/errors.js";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { sumNoteBytes, sumNoteBytesAfterSave } from "./note-db";
import { sumPortraitBytes } from "./portrait-db";

/** Shared portrait and note image byte cap for this account. Admins return `null` and are not limited. */
export function imageQuotaBytes(executor: Database | Transaction, userId: UserId) {
	return runQuery(executor.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1)).pipe(
		Effect.map((rows) => (rows[0]?.role === "admin" ? null : IMAGE_STORAGE_LIMITS.quotaBytes))
	);
}

/** Saved portrait and note image bytes against the shared quota. Unsaved `tmp/` uploads are not counted. */
export function imageStorageUsage(executor: Database | Transaction, userId: UserId) {
	return Effect.gen(function* () {
		return {
			portraitBytes: yield* sumPortraitBytes(executor, userId),
			noteBytes: yield* sumNoteBytes(executor, userId),
			quotaBytes: yield* imageQuotaBytes(executor, userId)
		};
	});
}

function exceeded(quotaBytes: number, subject: string) {
	return new ImageUploadError(`${subject} would exceed your ${formatStorageBytes(quotaBytes)} image storage limit.`, 413);
}

/**
 * Fails when replacing this character's saved portrait with `nextBytes` would take the account past the shared quota.
 * Run under `lockPortraitUser`, in the same transaction that updates `image_bytes`.
 */
export function assertPortraitQuota(tx: Transaction, userId: UserId, characterId: CharacterId, nextBytes: number) {
	return Effect.gen(function* () {
		const { portraitBytes, noteBytes, quotaBytes } = yield* imageStorageUsage(tx, userId);
		if (quotaBytes === null) return;

		const [current] = yield* runQuery(
			tx
				.select({ imageBytes: characters.imageBytes })
				.from(characters)
				.where(and(eq(characters.id, characterId), eq(characters.userId, userId)))
				.limit(1)
		);
		const credit = current?.imageBytes ?? 0;
		if (nextBytes > credit && portraitBytes + noteBytes - credit + nextBytes > quotaBytes) {
			return yield* exceeded(quotaBytes, "This image");
		}
	});
}

/**
 * Fails when saving `logId` with notes that reference `permanentKeys`, after promoting `addedBytes` of
 * staged images, would take the account past the shared quota. Images this save leaves without any
 * log reference are credited, so swapping one image for another at the limit works. A save that does
 * not grow usage always passes, even on an account that is already over. Run under `lockPortraitUser`.
 */
export function assertNoteSaveQuota(
	tx: Transaction,
	userId: UserId,
	logId: LogId,
	permanentKeys: readonly string[],
	addedBytes: number
) {
	return Effect.gen(function* () {
		const { portraitBytes, noteBytes, quotaBytes } = yield* imageStorageUsage(tx, userId);
		if (quotaBytes === null) return;
		const nextBytes = portraitBytes + (yield* sumNoteBytesAfterSave(tx, userId, logId, permanentKeys)) + addedBytes;
		if (nextBytes > quotaBytes && nextBytes > portraitBytes + noteBytes) {
			return yield* exceeded(quotaBytes, "These note images");
		}
	});
}
