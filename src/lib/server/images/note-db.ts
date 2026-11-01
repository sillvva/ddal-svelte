import { formatStorageBytes, NOTE_IMAGE_LIMITS } from "#lib/images/limits.js";
import { isPermanentNoteImageKey, TEMPORARY_IMAGE_PREFIX } from "#lib/images/object-key.js";
import type { LogId, UserId } from "#lib/schemas.js";
import { runQuery, type Database, type Transaction } from "#lib/server/db/index.js";
import { imageUploads, logImages, user } from "#lib/server/db/schema.js";
import { ImageUploadError } from "#lib/server/images/errors.js";
import { and, eq, inArray, isNull, notInArray, notLike, sql } from "drizzle-orm";
import { Effect } from "effect";
import { clearScheduledDeletions } from "./portrait-db";

function integer(value: unknown) {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

/** Saved note image bytes for one account. Unsaved `tmp/` uploads are not counted. */
export function sumNoteBytes(executor: Database | Transaction, userId: UserId) {
	return runQuery(
		executor
			.select({ total: sql<number>`coalesce(sum(${imageUploads.bytes}), 0)::int` })
			.from(imageUploads)
			.where(
				and(
					eq(imageUploads.userId, userId),
					eq(imageUploads.purpose, "note"),
					notLike(imageUploads.objectKey, `${TEMPORARY_IMAGE_PREFIX}%`)
				)
			)
	).pipe(Effect.map((rows) => integer(rows[0]?.total)));
}

/** Note image byte cap for this account. Admins return `null` and are not limited. */
export function noteQuotaBytes(executor: Database | Transaction, userId: UserId) {
	return runQuery(executor.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1)).pipe(
		Effect.map((rows) => (rows[0]?.role === "admin" ? null : NOTE_IMAGE_LIMITS.quotaBytes))
	);
}

/** Fails when saved note images plus `addedBytes` would exceed the account's cap. Run under `lockPortraitUser`. */
export function assertNoteQuota(tx: Transaction, userId: UserId, addedBytes: number) {
	return Effect.gen(function* () {
		const quotaBytes = yield* noteQuotaBytes(tx, userId);
		if (quotaBytes === null || addedBytes <= 0) return;
		const used = yield* sumNoteBytes(tx, userId);
		if (used + addedBytes > quotaBytes) {
			return yield* new ImageUploadError(
				`These note images would exceed your ${formatStorageBytes(quotaBytes)} note image storage limit.`,
				413
			);
		}
	});
}

/**
 * Makes `logId`'s `log_image` rows match the permanent note image keys in its notes.
 * Only the caller's own uploads are recorded. Deleting the rows for removed images fires the
 * `log_image` trigger, which queues any image left without a reference for deletion in that same statement.
 * Run under `lockPortraitUser`, after the log row is saved and its ownership confirmed.
 */
export function syncLogImages(tx: Transaction, userId: UserId, logId: LogId, permanentKeys: readonly string[]) {
	return Effect.gen(function* () {
		const keys = [...new Set(permanentKeys.filter(isPermanentNoteImageKey))];
		const uploads = keys.length
			? yield* runQuery(
					tx
						.select({ id: imageUploads.id, objectKey: imageUploads.objectKey })
						.from(imageUploads)
						.where(
							and(
								eq(imageUploads.userId, userId),
								eq(imageUploads.purpose, "note"),
								isNull(imageUploads.characterId),
								inArray(imageUploads.objectKey, keys)
							)
						)
				)
			: [];
		const uploadIds = uploads.map((upload) => upload.id);

		yield* runQuery(
			tx
				.delete(logImages)
				.where(and(eq(logImages.logId, logId), uploadIds.length ? notInArray(logImages.uploadId, uploadIds) : undefined))
		);

		if (uploadIds.length) {
			yield* runQuery(
				tx
					.insert(logImages)
					.values(uploadIds.map((uploadId) => ({ logId, uploadId })))
					.onConflictDoNothing()
			);
			yield* clearScheduledDeletions(
				tx,
				uploads.map((upload) => upload.objectKey)
			);
		}

		return uploads.map((upload) => upload.objectKey);
	});
}

/** Drops the upload row once its permanent object is deleted, so its bytes leave the note quota. */
export function forgetNoteUpload(tx: Transaction, key: string) {
	if (!isPermanentNoteImageKey(key)) return Effect.void;
	return runQuery(tx.delete(imageUploads).where(and(eq(imageUploads.objectKey, key), eq(imageUploads.purpose, "note")))).pipe(
		Effect.asVoid
	);
}
