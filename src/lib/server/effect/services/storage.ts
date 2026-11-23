import { computeOrphanedObjects, matchesOrphanSweepConfirmation, type BucketObject } from "#lib/admin-storage.js";
import {
	AVATAR_IMAGE_LIMITS,
	CHARACTER_IMAGE_LIMITS,
	isStoredImageContentType,
	NOTE_IMAGE_LIMITS,
	type StoredImageContentType
} from "#lib/images/limits.js";
import { magicBytesMatch } from "#lib/images/magic.js";
import { distinctNoteImageKeys, findNoteImageUrls, rewriteNoteImageUrls } from "#lib/images/note-images.js";
import {
	imagePublicUrl,
	isOwnedAvatarImageKey,
	isOwnedCharacterImageKey,
	isOwnedNoteImageKey,
	isOwnedTemporaryAvatarImageKey,
	isOwnedTemporaryImageKey,
	isOwnedTemporaryNoteImageKey,
	isPermanentCharacterImageKey,
	isPermanentImageKey,
	isTemporaryAvatarImageKey,
	isTemporaryCharacterImageKey,
	isTemporaryImageKey,
	keyFromPublicUrl,
	ownedAvatarKey,
	ownedPermanentKey,
	permanentImageKeyForTemporary,
	permanentKeyForTemporary,
	temporaryAvatarImageKey,
	temporaryCharacterImageKey,
	temporaryNoteImageKey,
	uploadIdFromImageKey,
	userIdFromPermanentKey
} from "#lib/images/object-key.js";
import type { CharacterId, ImageUploadId, LogId, UserId } from "#lib/schemas.js";
import { DBService, runQuery, type Transaction } from "#lib/server/db/index.js";
import { imageUploads, user } from "#lib/server/db/schema.js";
import { logErrors, logResults } from "#lib/server/effect/errors.js";
import { AppLog } from "#lib/server/effect/logging.js";
import { ImageUploadError } from "#lib/server/images/errors.js";
import { forgetNoteUpload, forgetOrphanedNoteUploads } from "#lib/server/images/note-db.js";
import {
	createOrphanSweepToken,
	executeOrphanDeletion,
	verifyOrphanSweepToken,
	type OrphanDeletionError
} from "#lib/server/images/orphan-sweep.js";
import {
	assertCustomAvatarAllowed,
	clearScheduledDeletions,
	findReferencedPermanentKeys,
	listPendingDeletions,
	listReferencedPermanentKeys,
	lockPendingDeletion,
	lockPortraitUser,
	notePendingFailure,
	permanentKeyInUse,
	promoteAvatarUploadRow,
	removePendingDeletion,
	scheduleDeletions,
	userIdForDeletion
} from "#lib/server/images/portrait-db.js";
import { assertNoteSaveQuota, assertPortraitQuota, imageStorageUsage } from "#lib/server/images/quota-db.js";
import { AUTH_SECRET, R2_ACCESS_KEY_ID, R2_BUCKET, R2_ENDPOINT, R2_SECRET_ACCESS_KEY } from "$app/env/private";
import { R2_PUBLIC_URL } from "$app/env/public";
import {
	CopyObjectCommand,
	DeleteObjectCommand,
	DeleteObjectsCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { Context, Effect, Layer, Result } from "effect";
import { v7 } from "uuid";

export { ImageUploadError } from "#lib/server/images/errors.js";

type PrepareImageInput = {
	userId: UserId;
	contentType: StoredImageContentType;
	bytes: number;
} & ({ purpose: "character"; characterId: CharacterId } | { purpose: "avatar" } | { purpose: "note" });

function maxStoredBytesFor(purpose: PrepareImageInput["purpose"]) {
	if (purpose === "avatar") return AVATAR_IMAGE_LIMITS.maxStoredBytes;
	if (purpose === "note") return NOTE_IMAGE_LIMITS.maxStoredBytes;
	return CHARACTER_IMAGE_LIMITS.maxStoredBytes;
}

export interface PromotedNoteImages {
	/** Notes with each promoted `tmp/` URL replaced by its permanent URL. */
	description: string;
	/** Permanent keys of the caller's note images the notes reference. */
	permanentKeys: string[];
	/** Staged objects copied by this save. Delete them once the log row is committed. */
	temporaryKeys: string[];
}

const NOTE_IMAGE_GONE = "An image in the notes is no longer available. Remove it and upload it again.";

export interface StagedCharacterImage {
	from: string;
	to: string;
}

export interface ResolvedCharacterImage {
	owned: boolean;
	bytes: number;
	/** URL to persist: a permanent public URL, an external URL, or the blank portrait. */
	imageUrl: string;
	/** Set when `imageUrl` still points at a `tmp/` object that must be copied before save. */
	copy: StagedCharacterImage | null;
}

const client = new S3Client({
	region: "auto",
	endpoint: R2_ENDPOINT.replace(/\/+$/, ""),
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY
	},
	// The SDK default, WHEN_SUPPORTED, adds x-amz-checksum-crc32 to presigned PUTs.
	// WHEN_REQUIRED leaves those headers off, so a CORS rule that allows Content-Type is enough.
	requestChecksumCalculation: "WHEN_REQUIRED",
	responseChecksumValidation: "WHEN_REQUIRED"
});

function integer(value: unknown) {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

function isMissingObject(cause: unknown) {
	if (typeof cause !== "object" || cause === null) return false;
	if ("name" in cause && (cause.name === "NotFound" || cause.name === "NoSuchKey")) return true;
	if (
		"$metadata" in cause &&
		typeof cause.$metadata === "object" &&
		cause.$metadata !== null &&
		"httpStatusCode" in cause.$metadata
	) {
		return cause.$metadata.httpStatusCode === 404;
	}
	return false;
}

function encodeCopySource(key: string) {
	return `${R2_BUCKET}/${key
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/")}`;
}

interface ByteSource {
	transformToByteArray: () => Promise<Uint8Array>;
}

function isByteSource(body: unknown): body is ByteSource {
	if (typeof body !== "object" || body === null || !("transformToByteArray" in body)) return false;
	return typeof body.transformToByteArray === "function";
}

function assertDeletable(key: string) {
	if (isPermanentImageKey(key) || isTemporaryImageKey(key)) return Effect.void;
	return Effect.fail(new ImageUploadError("Refusing to delete an object outside image storage", 500));
}

const deleteStoredObject = Effect.fn("StorageService.deleteStoredObject")(function* (key: string) {
	yield* assertDeletable(key);
	yield* Effect.tryPromise({
		try: async () => {
			try {
				await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
			} catch (cause) {
				if (!isMissingObject(cause)) throw cause;
			}
		},
		catch: (cause) => new ImageUploadError("Could not delete the stored image", 500, cause)
	});
});

const deleteStoredObjectsBatch = Effect.fn("StorageService.deleteStoredObjectsBatch")(function* (keys: readonly string[]) {
	if (!keys.length) return { deletedKeys: [] as string[], errors: [] as OrphanDeletionError[] };
	for (const key of keys) {
		if (!isPermanentImageKey(key)) {
			return yield* new ImageUploadError("Refusing to delete an object outside permanent image storage", 500);
		}
	}

	const result = yield* Effect.tryPromise({
		try: () =>
			client.send(
				new DeleteObjectsCommand({
					Bucket: R2_BUCKET,
					Delete: {
						Objects: keys.map((Key) => ({ Key })),
						Quiet: false
					}
				})
			),
		catch: (cause) => new ImageUploadError("Could not delete orphaned objects from storage", 500, cause)
	});

	const deletedKeys = (result.Deleted ?? []).map((entry) => entry.Key).filter((key): key is string => Boolean(key));
	const errors: OrphanDeletionError[] = (result.Errors ?? []).map((error) => ({
		key: error.Key ?? "",
		code: error.Code ?? "Error",
		message: error.Message ?? "Unknown error"
	}));

	return { deletedKeys, errors };
});

const headObject = Effect.fn("StorageService.headObject")(function* (key: string) {
	return yield* Effect.tryPromise({
		try: () => client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })),
		catch: (cause) =>
			isMissingObject(cause)
				? new ImageUploadError("Uploaded image was not found", 400, cause)
				: new ImageUploadError("Could not verify the uploaded image", 500, cause)
	});
});

const readMagicBytes = Effect.fn("StorageService.readMagicBytes")(function* (key: string) {
	const response = yield* Effect.tryPromise({
		try: () => client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: "bytes=0-11" })),
		catch: (cause) =>
			isMissingObject(cause)
				? new ImageUploadError("Uploaded image was not found", 400, cause)
				: new ImageUploadError("Could not verify the uploaded image", 500, cause)
	});
	if (!isByteSource(response.Body)) return yield* new ImageUploadError("Could not verify the uploaded image", 500);
	const body = response.Body;
	return yield* Effect.tryPromise({
		try: () => body.transformToByteArray(),
		catch: (cause) => new ImageUploadError("Could not verify the uploaded image", 500, cause)
	});
});

/** Confirms the staged object exists, matches the signed size and type, and has the right magic bytes. */
export const verifyStoredObject = Effect.fn("StorageService.verifyStoredObject")(
	function* (key: string, bytes: number, contentType: StoredImageContentType, maxBytes: number) {
		if (bytes < 1 || bytes > maxBytes) {
			return yield* new ImageUploadError("The uploaded file did not match the allowed size or type.", 400);
		}

		const head = yield* headObject(key);
		const actualType = head.ContentType?.split(";")[0]?.trim().toLowerCase();
		if (head.ContentLength !== bytes || actualType !== contentType) {
			return yield* new ImageUploadError("The uploaded file did not match the allowed size or type.", 400);
		}

		const magic = yield* readMagicBytes(key);
		if (!magicBytesMatch(contentType, magic)) {
			return yield* new ImageUploadError("The uploaded file did not match the allowed size or type.", 400);
		}
	},
	(effect, key, bytes, contentType, maxBytes) =>
		logErrors(effect, "StorageService.verifyStoredObject", { key, bytes, contentType, maxBytes })
);

const copyObject = Effect.fn("StorageService.copyObject")(function* (from: string, to: string) {
	if (!isTemporaryImageKey(from)) {
		return yield* ImageUploadError.reupload("The image is not a staged upload.");
	}
	if (permanentImageKeyForTemporary(from) !== to) {
		return yield* ImageUploadError.reupload("The image's storage location does not match its upload.");
	}

	yield* Effect.tryPromise({
		try: () =>
			client.send(
				new CopyObjectCommand({
					Bucket: R2_BUCKET,
					Key: to,
					CopySource: encodeCopySource(from)
				})
			),
		catch: (cause) => new ImageUploadError("Could not store the uploaded image.", 500, cause)
	});
});

/**
 * Re-checks the staged object, then copies it to its permanent key.
 * Call this while holding the portrait advisory lock, before the character row points at `staged.to`.
 */
export function copyVerifiedStage(tx: Transaction, userId: UserId, characterId: CharacterId, staged: StagedCharacterImage) {
	return Effect.gen(function* () {
		if (
			!isOwnedTemporaryImageKey(userId, characterId, staged.from) ||
			!isOwnedCharacterImageKey(userId, characterId, staged.to)
		) {
			return yield* ImageUploadError.reupload("The image was not uploaded for this character.");
		}
		if (permanentKeyForTemporary(staged.from) !== staged.to) {
			return yield* ImageUploadError.reupload("The image's storage location does not match its upload.");
		}

		const upload = yield* runQuery(
			tx.query.imageUploads.findFirst({
				columns: {
					id: true,
					bytes: true,
					contentType: true
				},
				where: {
					objectKey: { eq: staged.from },
					userId: { eq: userId },
					characterId: { eq: characterId }
				}
			})
		);
		if (!upload) return yield* ImageUploadError.reupload("The upload record for this image was not found.");
		if (!isStoredImageContentType(upload.contentType)) return yield* ImageUploadError.reupload("Invalid image type.");

		const filename = staged.to.split("/").pop() ?? "";
		const uploadId = filename.replace(/\.(webp|jpg)$/iu, "");
		if (upload.id !== uploadId) return yield* ImageUploadError.reupload("The image does not match its upload record.");

		yield* verifyStoredObject(staged.from, upload.bytes, upload.contentType, CHARACTER_IMAGE_LIMITS.maxStoredBytes);
		yield* copyObject(staged.from, staged.to);
	}).pipe((effect) => logErrors(effect, "StorageService.copyVerifiedStage", { userId, characterId, staged }));
}

/**
 * Re-checks a staged avatar, then copies it to its permanent key.
 * Call this while holding the image advisory lock, before `user.image` points at `staged.to`.
 */
export const copyVerifiedAvatar = Effect.fn("StorageService.copyVerifiedAvatar")(
	function* (tx: Transaction, userId: UserId, staged: StagedCharacterImage) {
		if (!isOwnedTemporaryAvatarImageKey(userId, staged.from) || !isOwnedAvatarImageKey(userId, staged.to)) {
			return yield* ImageUploadError.reupload("The image was not uploaded as this account's profile picture.");
		}
		if (permanentImageKeyForTemporary(staged.from) !== staged.to) {
			return yield* ImageUploadError.reupload("The image's storage location does not match its upload.");
		}

		const upload = yield* runQuery(
			tx.query.imageUploads.findFirst({
				columns: {
					id: true,
					bytes: true,
					contentType: true,
					characterId: true
				},
				where: {
					objectKey: { eq: staged.from },
					userId: { eq: userId },
					purpose: { eq: "avatar" }
				}
			})
		);
		if (!upload) return yield* ImageUploadError.reupload("The upload record for this image was not found.");
		if (upload.characterId !== null) return yield* ImageUploadError.reupload("The image was not uploaded as a profile picture.");
		if (!isStoredImageContentType(upload.contentType)) return yield* ImageUploadError.reupload("Invalid image type.");

		const filename = staged.to.split("/").pop() ?? "";
		const uploadId = filename.replace(/\.(webp|jpg)$/iu, "");
		if (upload.id !== uploadId) return yield* ImageUploadError.reupload("The image does not match its upload record.");

		yield* verifyStoredObject(staged.from, upload.bytes, upload.contentType, AVATAR_IMAGE_LIMITS.maxStoredBytes);
		yield* copyObject(staged.from, staged.to);
	},
	(effect, _tx, userId, staged) => logErrors(effect, "StorageService.copyVerifiedAvatar", { userId, staged })
);

/**
 * Promotes a verified avatar from `tmp/` to its permanent key.
 * Call inside the transaction that writes `user.image`, after `lockPortraitUser`.
 * This does not update the user row. `copied.permanentKey` is set as soon as the
 * object is copied, so the caller can abandon it if that transaction rolls back.
 */
export const promoteStagedAvatar = Effect.fn("StorageService.promoteStagedAvatar")(
	function* (tx: Transaction, userId: UserId, uploadId: ImageUploadId, copied: { permanentKey: string | null }) {
		yield* assertCustomAvatarAllowed(tx, userId);

		const upload = yield* runQuery(
			tx.query.imageUploads.findFirst({
				columns: {
					id: true,
					bytes: true,
					contentType: true,
					characterId: true,
					objectKey: true
				},
				where: {
					id: { eq: uploadId },
					userId: { eq: userId },
					purpose: { eq: "avatar" }
				}
			})
		);
		if (!upload) return yield* ImageUploadError.reupload("The upload record for this image was not found.");
		if (upload.characterId !== null) return yield* ImageUploadError.reupload("The image was not uploaded as a profile picture.");
		if (!isTemporaryAvatarImageKey(upload.objectKey)) {
			return yield* ImageUploadError.reupload("The image is not a staged profile picture upload.");
		}
		if (!isOwnedTemporaryAvatarImageKey(userId, upload.objectKey)) {
			return yield* ImageUploadError.reupload("The image was not uploaded from this account.");
		}
		if (!isStoredImageContentType(upload.contentType)) return yield* ImageUploadError.reupload("Invalid image type.");

		const permanent = permanentImageKeyForTemporary(upload.objectKey);
		if (!permanent) return yield* ImageUploadError.reupload("The image's storage location is invalid.");

		const current = yield* runQuery(
			tx.query.user.findFirst({
				columns: {
					image: true
				},
				where: {
					id: { eq: userId }
				}
			})
		);
		if (!current) return yield* new ImageUploadError("Upload was not found", 404);

		const previousKey = current.image ? ownedAvatarKey(userId, current.image, R2_PUBLIC_URL) : null;

		yield* copyVerifiedAvatar(tx, userId, { from: upload.objectKey, to: permanent });
		copied.permanentKey = permanent;

		if (previousKey && previousKey !== permanent) yield* scheduleDeletions(tx, [previousKey]);
		yield* clearScheduledDeletions(tx, [permanent]);

		const promoted = yield* promoteAvatarUploadRow(tx, userId, permanent);
		if (!promoted) return yield* ImageUploadError.reupload("The upload record for this image was already saved or removed.");

		return { imageUrl: imagePublicUrl(permanent, R2_PUBLIC_URL), temporaryKey: upload.objectKey };
	},
	(effect, _tx, userId, uploadId) => logErrors(effect, "StorageService.promoteStagedAvatar", { userId, uploadId })
);

/**
 * Promotes the caller's staged note images that `description` references and rewrites their URLs.
 * Only exact public URLs of this bucket's note keys are considered. A staged key must belong to the
 * caller and have a matching upload row. A staged URL whose upload an earlier save already promoted
 * is rewritten without copying. A staged object that expired fails the save with a field error.
 * Call inside the log save transaction, after `lockPortraitUser`. Each copied permanent key is pushed
 * to `copied` as soon as it exists, so the caller can abandon it if the transaction rolls back.
 */
export const promoteNoteImages = Effect.fn("StorageService.promoteNoteImages")(
	function* (tx: Transaction, userId: UserId, logId: LogId, description: string, copied: string[]) {
		const references = findNoteImageUrls(description, R2_PUBLIC_URL);
		const ownedKeys = distinctNoteImageKeys(references).filter((key) => isOwnedNoteImageKey(userId, key));
		if (ownedKeys.length > NOTE_IMAGE_LIMITS.maxImagesPerNote) {
			return yield* new ImageUploadError(`Notes can include up to ${NOTE_IMAGE_LIMITS.maxImagesPerNote} uploaded images.`);
		}

		const staged = [...new Set(references.filter((ref) => ref.temporary).map((ref) => ref.key))];
		if (staged.some((key) => !isOwnedTemporaryNoteImageKey(userId, key))) {
			return yield* new ImageUploadError(
				"An image in the notes was not uploaded from this account. Remove it and upload it again."
			);
		}

		const permanentFor = new Map<string, string>();
		const pending: { from: string; to: string; id: ImageUploadId; bytes: number; contentType: StoredImageContentType }[] = [];
		for (const from of staged) {
			const to = permanentImageKeyForTemporary(from);
			if (!to) return yield* new ImageUploadError(NOTE_IMAGE_GONE);

			const upload = yield* runQuery(
				tx.query.imageUploads.findFirst({
					columns: {
						id: true,
						bytes: true,
						contentType: true,
						objectKey: true
					},
					where: {
						userId: { eq: userId },
						purpose: { eq: "note" },
						characterId: {
							isNull: true
						},
						objectKey: { in: [from, to] }
					}
				})
			);
			if (!upload || upload.id !== uploadIdFromImageKey(from) || !isStoredImageContentType(upload.contentType)) {
				return yield* new ImageUploadError(NOTE_IMAGE_GONE);
			}

			permanentFor.set(from, to);
			if (upload.objectKey === to) continue;
			pending.push({ from, to, id: upload.id, bytes: upload.bytes, contentType: upload.contentType });
		}

		yield* assertNoteSaveQuota(
			tx,
			userId,
			logId,
			ownedKeys,
			pending.reduce((total, upload) => total + upload.bytes, 0)
		);

		for (const upload of pending) {
			yield* verifyStoredObject(upload.from, upload.bytes, upload.contentType, NOTE_IMAGE_LIMITS.maxStoredBytes).pipe(
				Effect.mapError((error) => (error.status === 400 ? new ImageUploadError(NOTE_IMAGE_GONE, 400, error) : error))
			);
			yield* copyObject(upload.from, upload.to);
			copied.push(upload.to);

			const promoted = yield* runQuery(
				tx
					.update(imageUploads)
					.set({ objectKey: upload.to, completedAt: new Date() })
					.where(and(eq(imageUploads.id, upload.id), eq(imageUploads.userId, userId), eq(imageUploads.objectKey, upload.from)))
					.returning({ id: imageUploads.id })
			);
			if (!promoted[0]) return yield* new ImageUploadError(NOTE_IMAGE_GONE);
		}

		return {
			description: rewriteNoteImageUrls(description, references, (ref) => {
				const permanent = ref.temporary ? permanentFor.get(ref.key) : undefined;
				return permanent ? imagePublicUrl(permanent, R2_PUBLIC_URL) : null;
			}),
			permanentKeys: ownedKeys,
			temporaryKeys: pending.map((upload) => upload.from)
		} satisfies PromotedNoteImages;
	},
	(effect, _tx, userId, logId) => logErrors(effect, "StorageService.promoteNoteImages", { userId, logId })
);

const signPut = Effect.fn("StorageService.signPut")(function* (key: string, contentType: StoredImageContentType, bytes: number) {
	return yield* Effect.tryPromise({
		try: () =>
			getSignedUrl(
				client,
				new PutObjectCommand({
					Bucket: R2_BUCKET,
					Key: key,
					ContentType: contentType,
					ContentLength: bytes
				}),
				{
					expiresIn: CHARACTER_IMAGE_LIMITS.signedUrlSeconds,
					signableHeaders: new Set(["content-type", "content-length"])
				}
			),
		catch: (cause) => new ImageUploadError("Could not prepare the upload", 500, cause)
	});
});

export class StorageService extends Context.Service<StorageService>()("StorageService", {
	make: Effect.fn("StorageService")(function* () {
		const { db, transaction } = yield* DBService;

		const listPrefixObjects = Effect.fn("StorageService.listPrefixObjects")(function* (prefix: string) {
			const objects: BucketObject[] = [];
			let token: string | undefined;
			do {
				const page = yield* Effect.tryPromise({
					try: () =>
						client.send(
							new ListObjectsV2Command({
								Bucket: R2_BUCKET,
								Prefix: prefix,
								ContinuationToken: token
							})
						),
					catch: (cause) => new ImageUploadError("Could not list stored images", 500, cause)
				});
				for (const object of page.Contents ?? []) {
					if (object.Key) {
						objects.push({
							key: object.Key,
							bytes: integer(object.Size),
							lastModified: object.LastModified ?? null
						});
					}
				}
				token = page.IsTruncated ? page.NextContinuationToken : undefined;
			} while (token);
			return objects;
		});

		const listPrefix = Effect.fn("StorageService.listPrefix")(function* (prefix: string) {
			const objects = yield* listPrefixObjects(prefix);
			return objects.map((object) => object.key);
		});

		const purgeOnePendingObject = Effect.fn("StorageService.purgeOnePendingObject")(function* (objectKey: string) {
			return yield* transaction(
				Effect.fn(function* (tx) {
					const userId = userIdForDeletion(objectKey);
					// Staged `tmp/` keys are not queued. Drop anything else without deleting the object.
					if (!userId || !isPermanentImageKey(objectKey)) {
						const existing = yield* lockPendingDeletion(tx, objectKey);
						if (!existing) return { status: "missing" as const };
						yield* removePendingDeletion(tx, objectKey);
						return { status: "dropped-invalid" as const };
					}

					yield* lockPortraitUser(tx, userId);
					const current = yield* lockPendingDeletion(tx, objectKey);
					if (!current) return { status: "missing" as const };

					// A portrait or avatar saved again, or a note image referenced again, after this key was queued.
					// Keep the object and drop the request.
					if (isPermanentImageKey(current.objectKey) && (yield* permanentKeyInUse(tx, current.objectKey))) {
						yield* clearScheduledDeletions(tx, [current.objectKey]);
						return { status: "in-use" as const };
					}

					const deleted = yield* Effect.result(deleteStoredObject(current.objectKey));
					if (Result.isSuccess(deleted)) {
						yield* removePendingDeletion(tx, current.objectKey);
						yield* forgetNoteUpload(tx, current.objectKey);
						return { status: "deleted" as const };
					}

					yield* notePendingFailure(tx, current.objectKey);
					return { status: "failed" as const, message: deleted.failure.message };
				})
			);
		});

		/**
		 * Deletes every object queued in `pending_object_deletion`.
		 * Each key is attempted once per call. A failure stays queued for a later call.
		 */
		const purgePendingObjects = Effect.fn("StorageService.purgePendingObjects")(function* () {
			const attempted = new Set<string>();

			for (let batch = 0; batch < 20; batch++) {
				const pending = yield* transaction((tx) => listPendingDeletions(tx, 50)).pipe(
					Effect.catch((error) =>
						AppLog.error("StorageService.purgePendingObjects", { message: error.message }).pipe(Effect.as([]))
					)
				);
				const fresh = pending.filter((row) => !attempted.has(row.objectKey));
				if (!fresh.length) return;

				for (const row of fresh) {
					attempted.add(row.objectKey);
					yield* purgeOnePendingObject(row.objectKey).pipe(
						Effect.catch((error) =>
							AppLog.error("StorageService.purgePendingObjects", { message: error.message, key: row.objectKey })
						)
					);
				}
			}
		});

		const cleanupSavedObject = Effect.fn("StorageService.cleanupAfterSave")(
			function* (tmpKeys: string | null | readonly string[]) {
				const keys = tmpKeys === null ? [] : typeof tmpKeys === "string" ? [tmpKeys] : tmpKeys;
				for (const tmpKey of keys) {
					if (!isTemporaryImageKey(tmpKey)) continue;
					yield* deleteStoredObject(tmpKey).pipe(
						Effect.catch((error) => AppLog.error("StorageService.cleanupAfterSave", { message: error.message, key: tmpKey }))
					);
				}

				yield* purgePendingObjects();
			},
			(effect, tmpKeys) => logErrors(effect, "StorageService.cleanupAfterSave", { tmpKeys })
		);

		const abandonStagedObject = Effect.fn("StorageService.abandonStagedObject")(
			function* (userId: UserId, key: string) {
				yield* transaction(
					Effect.fn(function* (tx) {
						yield* lockPortraitUser(tx, userId);
						if (yield* permanentKeyInUse(tx, key)) return;
						yield* scheduleDeletions(tx, [key]);
					})
				);
				yield* purgePendingObjects();
			},
			(effect, userId, key) => logErrors(effect, "StorageService.abandonStagedObject", { userId, key })
		);

		return {
			/** Saved portrait and note image bytes against the shared quota. `quotaBytes` is null for admins. Unsaved `tmp/` uploads are not included. */
			imageUsage: Effect.fn("StorageService.imageUsage")(
				function* (userId: UserId) {
					return yield* imageStorageUsage(db, userId);
				},
				(effect, userId) => logErrors(effect, "StorageService.imageUsage", { userId })
			),

			/**
			 * Reserves a `tmp/` object and returns a presigned PUT.
			 * Portraits get a fast image storage quota check here. The authoritative check runs again under the
			 * same advisory lock when the character is saved. Note images are only checked when a log save
			 * promotes them, because that save may also drop images and free the room they need. Avatars are not
			 * part of the quota. A presigned URL cannot write a permanent key, so discarding the reservation
			 * cannot free quota for an object that stays.
			 */
			prepare: Effect.fn("StorageService.prepare")(
				function* (input: PrepareImageInput) {
					yield* purgePendingObjects();

					if (input.bytes > maxStoredBytesFor(input.purpose)) {
						return yield* new ImageUploadError("Image is too large to store.", 413);
					}

					const reserved = yield* transaction(
						Effect.fn(function* (tx) {
							yield* lockPortraitUser(tx, input.userId);

							if (input.purpose === "character") {
								const character = yield* runQuery(
									tx.query.characters.findFirst({
										columns: {
											userId: true
										},
										where: {
											id: { eq: input.characterId }
										}
									})
								);
								if (character && character.userId !== input.userId) {
									return yield* new ImageUploadError("Character not found", 404);
								}

								yield* assertPortraitQuota(tx, input.userId, input.characterId, input.bytes);
							} else if (input.purpose === "avatar") {
								yield* assertCustomAvatarAllowed(tx, input.userId);
							}

							// Note uploads have their own hourly budget, so a note full of images does not use up portrait uploads.
							const rate = input.purpose === "note" ? NOTE_IMAGE_LIMITS : CHARACTER_IMAGE_LIMITS;
							const [recent] = yield* runQuery(
								tx
									.select({ total: sql<number>`count(*)::int` })
									.from(imageUploads)
									.where(
										and(
											eq(imageUploads.userId, input.userId),
											input.purpose === "note" ? eq(imageUploads.purpose, "note") : ne(imageUploads.purpose, "note"),
											gt(imageUploads.createdAt, new Date(Date.now() - rate.rateWindowMs))
										)
									)
							);
							if (integer(recent?.total) >= rate.maxUploadsPerWindow) {
								return yield* new ImageUploadError(
									`You can upload ${rate.maxUploadsPerWindow} images per hour. Try again later.`,
									429
								);
							}

							const uploadId = v7() as ImageUploadId;
							const objectKey =
								input.purpose === "character"
									? temporaryCharacterImageKey(input.userId, input.characterId, uploadId, input.contentType)
									: input.purpose === "avatar"
										? temporaryAvatarImageKey(input.userId, uploadId, input.contentType)
										: temporaryNoteImageKey(input.userId, uploadId, input.contentType);
							yield* runQuery(
								tx.insert(imageUploads).values({
									id: uploadId,
									userId: input.userId,
									characterId: input.purpose === "character" ? input.characterId : null,
									purpose: input.purpose,
									objectKey,
									bytes: input.bytes,
									contentType: input.contentType
								})
							);

							return { uploadId, objectKey };
						})
					);

					const uploadUrl = yield* signPut(reserved.objectKey, input.contentType, input.bytes);
					return {
						uploadId: reserved.uploadId,
						uploadUrl,
						contentType: input.contentType
					};
				},
				(effect, input) => logResults(effect, "StorageService.prepare", input)
			),

			complete: Effect.fn("StorageService.complete")(
				function* (userId: UserId, uploadId: ImageUploadId, purpose?: PrepareImageInput["purpose"]) {
					const upload = yield* runQuery(
						db.query.imageUploads.findFirst({
							where: {
								id: { eq: uploadId },
								userId: { eq: userId }
							}
						})
					);
					if (!upload || (purpose !== undefined && upload.purpose !== purpose)) {
						return yield* new ImageUploadError("Upload was not found", 404);
					}
					if (!isStoredImageContentType(upload.contentType)) {
						return yield* new ImageUploadError("The uploaded file did not match the allowed size or type.", 400);
					}

					const avatar =
						upload.purpose === "avatar" &&
						upload.characterId === null &&
						isOwnedTemporaryAvatarImageKey(userId, upload.objectKey);
					const portrait =
						upload.purpose === "character" &&
						upload.characterId !== null &&
						isOwnedTemporaryImageKey(userId, upload.characterId, upload.objectKey);
					const note =
						upload.purpose === "note" && upload.characterId === null && isOwnedTemporaryNoteImageKey(userId, upload.objectKey);
					if (!avatar && !portrait && !note) return yield* new ImageUploadError("Upload was not found", 404);

					if (avatar) {
						yield* transaction(
							Effect.fn(function* (tx) {
								yield* assertCustomAvatarAllowed(tx, userId);
							})
						);
					}

					yield* verifyStoredObject(upload.objectKey, upload.bytes, upload.contentType, maxStoredBytesFor(upload.purpose));

					if (!upload.completedAt) {
						yield* runQuery(db.update(imageUploads).set({ completedAt: new Date() }).where(eq(imageUploads.id, upload.id)));
					}

					// `tmp/` objects are public on the image host until save copies them, or the lifecycle rule deletes them.
					return { imageUrl: imagePublicUrl(upload.objectKey, R2_PUBLIC_URL) };
				},
				(effect, userId, uploadId, purpose) => logResults(effect, "StorageService.complete", { userId, uploadId, purpose })
			),

			resolveForSave: Effect.fn("StorageService.resolveForSave")(
				function* (input: { userId: UserId; characterId: CharacterId; imageUrl: string }) {
					const key = input.imageUrl ? keyFromPublicUrl(input.imageUrl, R2_PUBLIC_URL) : null;
					// Only block temporary (staged) non-character-purpose image keys.
					// Permanent public CDN URLs from other app sections (notes, avatars, etc.) are
					// treated as external URLs, the same as any other https:// image link.
					if (key && isTemporaryImageKey(key) && !isTemporaryCharacterImageKey(key)) {
						return yield* ImageUploadError.reupload("The image was not uploaded as a character portrait.");
					}
					if (key && (isTemporaryCharacterImageKey(key) || isPermanentCharacterImageKey(key))) {
						if (isOwnedTemporaryImageKey(input.userId, input.characterId, key)) {
							const permanent = permanentKeyForTemporary(key);
							if (!permanent) return yield* ImageUploadError.reupload("The image's storage location is invalid.");

							const upload = yield* runQuery(
								db.query.imageUploads.findFirst({
									columns: {
										bytes: true,
										contentType: true
									},
									where: {
										objectKey: { eq: key },
										userId: { eq: input.userId },
										characterId: { eq: input.characterId }
									}
								})
							);
							if (!upload) return yield* ImageUploadError.reupload("The upload record for this image was not found.");
							if (!isStoredImageContentType(upload.contentType)) return yield* ImageUploadError.reupload("Invalid image type.");

							return {
								owned: true,
								bytes: upload.bytes,
								imageUrl: imagePublicUrl(permanent, R2_PUBLIC_URL),
								copy: { from: key, to: permanent }
							} satisfies ResolvedCharacterImage;
						}

						const current = yield* runQuery(
							db.query.characters.findFirst({
								columns: {
									imageUrl: true,
									imageBytes: true
								},
								where: {
									id: { eq: input.characterId },
									userId: { eq: input.userId }
								}
							})
						);
						const currentKey = current
							? ownedPermanentKey(input.userId, input.characterId, current.imageUrl, R2_PUBLIC_URL)
							: null;
						if (current && currentKey && currentKey === key) {
							return {
								owned: true,
								bytes: current.imageBytes,
								imageUrl: imagePublicUrl(currentKey, R2_PUBLIC_URL),
								copy: null
							} satisfies ResolvedCharacterImage;
						}

						return yield* ImageUploadError.reupload("The image is not this character's current portrait or a new upload for it.");
					}

					return {
						owned: false,
						bytes: 0,
						imageUrl: input.imageUrl,
						copy: null
					} satisfies ResolvedCharacterImage;
				},
				(effect, input) => logResults(effect, "StorageService.resolveForSave", input)
			),

			/**
			 * Deletes the staged objects and any permanent objects queued by the save.
			 * Failures are logged. The owning row is already saved by the time this runs.
			 */
			cleanupAfterSave: cleanupSavedObject,

			/**
			 * Promotes a verified avatar from `tmp/` to its permanent key and stores it on the user.
			 * Closing the dialog without calling this leaves the staged object for the bucket lifecycle rule.
			 */
			saveAvatar: Effect.fn("StorageService.saveAvatar")(
				function* (userId: UserId, uploadId: ImageUploadId) {
					const copied = { permanentKey: null as string | null };
					let tmpKey: string | null = null;

					const saved = yield* transaction(
						Effect.fn(function* (tx) {
							yield* lockPortraitUser(tx, userId);
							const promoted = yield* promoteStagedAvatar(tx, userId, uploadId, copied);
							tmpKey = promoted.temporaryKey;

							const updated = yield* runQuery(
								tx.update(user).set({ image: promoted.imageUrl }).where(eq(user.id, userId)).returning({ id: user.id })
							);
							if (!updated[0]) return yield* new ImageUploadError("Could not store the uploaded image.", 500);
							return { imageUrl: promoted.imageUrl };
						})
					).pipe(
						Effect.tapError(() => {
							const orphanKey = copied.permanentKey;
							if (!orphanKey) return Effect.void;
							return abandonStagedObject(userId, orphanKey).pipe(Effect.ignore);
						})
					);

					yield* cleanupSavedObject(tmpKey);
					return saved;
				},
				(effect, userId, uploadId) => logResults(effect, "StorageService.saveAvatar", { userId, uploadId })
			),

			purgePending: Effect.fn("StorageService.purgePending")(function* () {
				yield* purgePendingObjects();
			}),

			getPendingDeletionQueue: Effect.fn("StorageService.getPendingDeletionQueue")(
				function* () {
					const items = yield* listPendingDeletions(db);
					return { bucket: R2_BUCKET, items };
				},
				(effect) => logErrors(effect, "StorageService.getPendingDeletionQueue", {})
			),

			retryPendingDeletion: Effect.fn("StorageService.retryPendingDeletion")(
				function* (objectKey: string) {
					const outcome = yield* purgeOnePendingObject(objectKey);
					if (outcome.status === "failed") {
						yield* AppLog.error("StorageService.retryPendingDeletion", {
							bucket: R2_BUCKET,
							objectKey,
							outcome
						});
					} else {
						yield* AppLog.info("StorageService.retryPendingDeletion", {
							bucket: R2_BUCKET,
							objectKey,
							outcome
						});
					}
					return outcome;
				},
				(effect, objectKey) => logErrors(effect, "StorageService.retryPendingDeletion", { objectKey })
			),

			removePendingDeletion: Effect.fn("StorageService.removePendingDeletion")(
				function* (objectKey: string) {
					const removed = yield* transaction(
						Effect.fn(function* (tx) {
							const existing = yield* lockPendingDeletion(tx, objectKey);
							if (!existing) return false;
							yield* removePendingDeletion(tx, objectKey);
							return true;
						})
					);
					yield* AppLog.info("StorageService.removePendingDeletion", {
						bucket: R2_BUCKET,
						objectKey,
						removed
					});
					return { removed };
				},
				(effect, objectKey) => logErrors(effect, "StorageService.removePendingDeletion", { objectKey })
			),

			/**
			 * Dry-run scan of permanent keys in `R2_BUCKET` that are not referenced by `character.image_url`,
			 * `user.image`, `image_upload.object_key`, or `pending_object_deletion`. Skips `tmp/`.
			 * Returns an HMAC-signed token binding the exact key list to this bucket, admin, and scan time.
			 */
			scanOrphanedObjects: Effect.fn("StorageService.scanOrphanedObjects")(
				function* (adminUserId: UserId) {
					// Permanent image keys live under `users/`; `tmp/` is skipped both by prefix and in `computeOrphanedObjects`.
					const objects = yield* listPrefixObjects("users/");
					const referencedKeys = yield* listReferencedPermanentKeys(db);
					const summary = computeOrphanedObjects(objects, referencedKeys);
					const issuedAt = Date.now();
					const token = createOrphanSweepToken(
						{
							bucket: R2_BUCKET,
							userId: adminUserId,
							issuedAt,
							keys: summary.orphans.map((object) => object.key)
						},
						AUTH_SECRET
					);

					return {
						bucket: R2_BUCKET,
						scannedAt: new Date(issuedAt),
						issuedAt,
						token,
						scannedPermanentCount: summary.scannedPermanentCount,
						totalBytes: summary.totalBytes,
						orphans: summary.orphans
					};
				},
				(effect, adminUserId) => logErrors(effect, "StorageService.scanOrphanedObjects", { adminUserId })
			),

			/**
			 * Deletes orphaned permanent objects that came from a confirmed dry run.
			 * Verifies the signed dry-run token and confirmation text on the server, re-checks each batch
			 * against the database right before deleting, deletes in batches of at most 1000 via `DeleteObjects`,
			 * and logs the outcome.
			 */
			deleteOrphanedObjects: Effect.fn("StorageService.deleteOrphanedObjects")(
				function* (
					adminUserId: UserId,
					input: { keys: readonly string[]; token: string; issuedAt: number; confirmation: string }
				) {
					const verified = verifyOrphanSweepToken(
						{
							bucket: R2_BUCKET,
							userId: adminUserId,
							issuedAt: input.issuedAt,
							keys: input.keys,
							token: input.token
						},
						AUTH_SECRET
					);
					if (!verified.ok) {
						return yield* new ImageUploadError(verified.reason, 400);
					}

					if (!matchesOrphanSweepConfirmation(R2_BUCKET, verified.keys.length, input.confirmation)) {
						return yield* new ImageUploadError("Confirmation text does not match.", 400);
					}

					const result = yield* executeOrphanDeletion(verified.keys, {
						findReferenced: (batch) => transaction((tx) => findReferencedPermanentKeys(tx, batch)),
						deleteBatch: (batch) =>
							deleteStoredObjectsBatch(batch).pipe(
								Effect.tap((result) =>
									// The object is gone, so drop the stale upload rows of deleted note images.
									transaction((tx) => forgetOrphanedNoteUploads(tx, result.deletedKeys))
								)
							)
					});

					const logPayload = {
						bucket: R2_BUCKET,
						requestedCount: result.requestedCount,
						deletedCount: result.deletedCount,
						skippedCount: result.skippedCount,
						failedCount: result.failedCount,
						deletedKeys: result.deletedKeys.slice(0, 100),
						deletedKeysTruncated: result.deletedKeys.length > 100,
						skippedKeys: result.skippedKeys.slice(0, 100),
						skippedKeysTruncated: result.skippedKeys.length > 100,
						errors: result.errors.slice(0, 100)
					};

					if (result.failedCount > 0) {
						yield* AppLog.error("StorageService.deleteOrphanedObjects", logPayload);
					} else {
						yield* AppLog.info("StorageService.deleteOrphanedObjects", logPayload);
					}

					return { bucket: R2_BUCKET, ...result };
				},
				(effect, adminUserId, input) =>
					logErrors(effect, "StorageService.deleteOrphanedObjects", {
						adminUserId,
						keyCount: input.keys.length
					})
			),

			/**
			 * Permanent portraits, avatars, and note images stored for this account.
			 * Listing is best-effort for objects whose upload row was already removed.
			 * Staged `tmp/` uploads are omitted; the bucket lifecycle rule deletes that prefix.
			 */
			listOwnedImageKeys: Effect.fn("StorageService.listOwnedImageKeys")(
				function* (userId: UserId) {
					const prefix = `users/${userId}/`;
					const keys = new Set<string>();
					const found = yield* listPrefix(prefix);
					for (const key of found) {
						if (!key.startsWith(prefix) || !isPermanentImageKey(key) || userIdFromPermanentKey(key) !== userId) continue;
						keys.add(key);
					}
					return [...keys];
				},
				(effect, userId) => logErrors(effect, "StorageService.listOwnedImageKeys", { userId })
			),

			abandonStagedObject
		};
	})()
}) {
	static readonly layer = Layer.effect(this, this.make);
}
