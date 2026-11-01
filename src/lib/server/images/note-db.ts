import { isPermanentNoteImageKey, TEMPORARY_IMAGE_PREFIX } from "#lib/images/object-key.js";
import type { LogId, UserId } from "#lib/schemas.js";
import { runQuery, type Database, type Transaction } from "#lib/server/db/index.js";
import { imageUploads, logImages } from "#lib/server/db/schema.js";
import { and, eq, exists, inArray, isNull, ne, notInArray, notLike, or, sql, type SQL } from "drizzle-orm";
import { Effect } from "effect";
import { clearScheduledDeletions } from "./portrait-db";

function integer(value: unknown) {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

function sumOwnedNoteBytes(executor: Database | Transaction, userId: UserId, counted: SQL | undefined) {
	return runQuery(
		executor
			.select({ total: sql<number>`coalesce(sum(${imageUploads.bytes}), 0)::int` })
			.from(imageUploads)
			.where(
				and(
					eq(imageUploads.userId, userId),
					eq(imageUploads.purpose, "note"),
					notLike(imageUploads.objectKey, `${TEMPORARY_IMAGE_PREFIX}%`),
					counted
				)
			)
	).pipe(Effect.map((rows) => integer(rows[0]?.total)));
}

/**
 * Saved note image bytes for one account: images at least one log still references.
 * An image stops counting as soon as its last reference goes, while it waits in `pending_object_deletion`.
 * Unsaved `tmp/` uploads are not counted.
 */
export function sumNoteBytes(executor: Database | Transaction, userId: UserId) {
	return sumOwnedNoteBytes(
		executor,
		userId,
		exists(
			executor
				.select({ one: sql`1` })
				.from(logImages)
				.where(eq(logImages.uploadId, imageUploads.id))
		)
	);
}

/**
 * What `sumNoteBytes` will be once `logId` references exactly `permanentKeys`: images another log
 * references, plus the already promoted images in `permanentKeys`. Staged images promoted by the same
 * save are not included. Run under `lockPortraitUser`.
 */
export function sumNoteBytesAfterSave(tx: Transaction, userId: UserId, logId: LogId, permanentKeys: readonly string[]) {
	const keys = [...new Set(permanentKeys.filter(isPermanentNoteImageKey))];
	return sumOwnedNoteBytes(
		tx,
		userId,
		or(
			exists(
				tx
					.select({ one: sql`1` })
					.from(logImages)
					.where(and(eq(logImages.uploadId, imageUploads.id), ne(logImages.logId, logId)))
			),
			keys.length ? inArray(imageUploads.objectKey, keys) : undefined
		)
	);
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

/** Drops the upload row once its permanent object is deleted. */
export function forgetNoteUpload(tx: Transaction, key: string) {
	if (!isPermanentNoteImageKey(key)) return Effect.void;
	return runQuery(tx.delete(imageUploads).where(and(eq(imageUploads.objectKey, key), eq(imageUploads.purpose, "note")))).pipe(
		Effect.asVoid
	);
}
