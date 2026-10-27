import { magicBytesMatch } from "#lib/images/magic.js";
import {
	AVATAR_IMAGE_LIMITS,
	CHARACTER_IMAGE_LIMITS,
	isStoredImageContentType,
	type StoredImageContentType
} from "#lib/images/limits.js";
import {
	imagePublicUrl,
	isOwnedAvatarImageKey,
	isOwnedCharacterImageKey,
	isOwnedTemporaryAvatarImageKey,
	isOwnedTemporaryImageKey,
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
	temporaryCharacterImageKey
} from "#lib/images/object-key.js";
import type { CharacterId, CharacterImageUploadId, UserId } from "#lib/schemas.js";
import { runQuery, type Transaction } from "#lib/server/db/index.js";
import { DBService } from "#lib/server/db/index.js";
import { characterImageUploads, characters, user } from "#lib/server/db/schema.js";
import { AppLog } from "#lib/server/effect/logging.js";
import { ImageUploadError } from "#lib/server/images/errors.js";
import {
	assertCustomAvatarAllowed,
	assertImageQuota,
	assertPortraitQuota,
	clearScheduledDeletions,
	listPendingDeletions,
	lockPendingDeletion,
	lockPortraitUser,
	notePendingFailure,
	permanentKeyInUse,
	promoteAvatarUploadRow,
	removePendingDeletion,
	scheduleDeletions,
	userIdForDeletion
} from "#lib/server/images/portrait-db.js";
import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { R2_ACCESS_KEY_ID, R2_BUCKET, R2_ENDPOINT, R2_SECRET_ACCESS_KEY } from "$app/env/private";
import { R2_PUBLIC_URL } from "$app/env/public";
import { and, eq, gt, sql } from "drizzle-orm";
import { Context, Effect, Layer, Result } from "effect";
import { v7 } from "uuid";

export { ImageUploadError } from "#lib/server/images/errors.js";

type PrepareImageInput = {
	userId: UserId;
	contentType: StoredImageContentType;
	bytes: number;
} & ({ purpose: "character"; characterId: CharacterId } | { purpose: "avatar" });

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

function errorMessage(cause: unknown) {
	if (typeof cause === "object" && cause !== null && "message" in cause && typeof cause.message === "string") {
		return cause.message;
	}
	return "Could not delete the stored image";
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
export function verifyStoredObject(key: string, bytes: number, contentType: StoredImageContentType, maxBytes: number) {
	return Effect.gen(function* () {
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
	});
}

const copyObject = Effect.fn("StorageService.copyObject")(function* (from: string, to: string) {
	if (!isTemporaryImageKey(from) || permanentImageKeyForTemporary(from) !== to) {
		return yield* new ImageUploadError("Upload that image again before saving.");
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
			return yield* new ImageUploadError("Upload that image again before saving.");
		}
		if (permanentKeyForTemporary(staged.from) !== staged.to) {
			return yield* new ImageUploadError("Upload that image again before saving.");
		}

		const rows = yield* runQuery(
			tx
				.select()
				.from(characterImageUploads)
				.where(
					and(
						eq(characterImageUploads.objectKey, staged.from),
						eq(characterImageUploads.userId, userId),
						eq(characterImageUploads.characterId, characterId)
					)
				)
				.limit(1)
		);
		const upload = rows[0];
		if (!upload || !isStoredImageContentType(upload.contentType)) {
			return yield* new ImageUploadError("Upload that image again before saving.");
		}

		const filename = staged.to.split("/").pop() ?? "";
		const uploadId = filename.replace(/\.(webp|jpg)$/iu, "");
		if (upload.id !== uploadId) return yield* new ImageUploadError("Upload that image again before saving.");

		yield* verifyStoredObject(staged.from, upload.bytes, upload.contentType, CHARACTER_IMAGE_LIMITS.maxStoredBytes);
		yield* copyObject(staged.from, staged.to);
	});
}

/**
 * Re-checks a staged avatar, then copies it to its permanent key.
 * Call this while holding the image advisory lock, before `user.image` points at `staged.to`.
 */
export function copyVerifiedAvatar(tx: Transaction, userId: UserId, staged: StagedCharacterImage) {
	return Effect.gen(function* () {
		if (!isOwnedTemporaryAvatarImageKey(userId, staged.from) || !isOwnedAvatarImageKey(userId, staged.to)) {
			return yield* new ImageUploadError("Upload that image again before saving.");
		}
		if (permanentImageKeyForTemporary(staged.from) !== staged.to) {
			return yield* new ImageUploadError("Upload that image again before saving.");
		}

		const rows = yield* runQuery(
			tx
				.select()
				.from(characterImageUploads)
				.where(
					and(
						eq(characterImageUploads.objectKey, staged.from),
						eq(characterImageUploads.userId, userId),
						eq(characterImageUploads.purpose, "avatar")
					)
				)
				.limit(1)
		);
		const upload = rows[0];
		if (!upload || upload.characterId !== null || !isStoredImageContentType(upload.contentType)) {
			return yield* new ImageUploadError("Upload that image again before saving.");
		}

		const filename = staged.to.split("/").pop() ?? "";
		const uploadId = filename.replace(/\.(webp|jpg)$/iu, "");
		if (upload.id !== uploadId) return yield* new ImageUploadError("Upload that image again before saving.");

		yield* verifyStoredObject(staged.from, upload.bytes, upload.contentType, AVATAR_IMAGE_LIMITS.maxStoredBytes);
		yield* copyObject(staged.from, staged.to);
	});
}

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

		/** Retries permanent-object deletes. Uses the service's transaction so callers do not depend on DBService. */
		const purgePendingObjects = Effect.fn("StorageService.purgePendingObjects")(function* () {
			const pending = yield* transaction((tx) => listPendingDeletions(tx, 20)).pipe(
				Effect.catch((error) =>
					AppLog.error("StorageService.purgePendingObjects", { message: error.message }).pipe(Effect.as([]))
				)
			);

			for (const row of pending) {
				let failure = "";
				yield* transaction(
					Effect.fn(function* (tx) {
						const userId = userIdForDeletion(row.objectKey);
						if (!userId || !isPermanentImageKey(row.objectKey)) {
							yield* removePendingDeletion(tx, row.objectKey);
							return;
						}

						yield* lockPortraitUser(tx, userId);
						const current = yield* lockPendingDeletion(tx, row.objectKey);
						if (!current) return;

						// A portrait saved again after this key was queued. Keep the object and drop the request.
						if (yield* permanentKeyInUse(tx, current.objectKey)) {
							yield* clearScheduledDeletions(tx, [current.objectKey]);
							return;
						}

						const deleted = yield* Effect.result(deleteStoredObject(current.objectKey));
						if (Result.isSuccess(deleted)) {
							yield* removePendingDeletion(tx, current.objectKey);
							return;
						}

						failure = errorMessage(deleted.failure);
						yield* notePendingFailure(tx, current.objectKey);
					})
				).pipe(Effect.catch((error) => AppLog.error("StorageService.purgePendingObjects", { message: error.message })));

				if (failure) {
					yield* AppLog.error("StorageService.purgePendingObjects", { message: failure, key: row.objectKey });
				}
			}
		});

		const cleanupSavedObject = Effect.fn("StorageService.cleanupAfterSave")(function* (tmpKey: string | null) {
			if (tmpKey && isTemporaryImageKey(tmpKey)) {
				yield* deleteStoredObject(tmpKey).pipe(
					Effect.catch((error) => AppLog.error("StorageService.cleanupAfterSave", { message: error.message, key: tmpKey }))
				);
			}

			yield* purgePendingObjects();
		});

		const abandonStagedObject = Effect.fn("StorageService.abandonStagedObject")(function* (userId: UserId, key: string) {
			yield* transaction(
				Effect.fn(function* (tx) {
					yield* lockPortraitUser(tx, userId);
					if (yield* permanentKeyInUse(tx, key)) return;
					yield* scheduleDeletions(tx, [key]);
				})
			);
			yield* purgePendingObjects();
		});

		return {
			/**
			 * Reserves a `tmp/` object and returns a presigned PUT.
			 * Quota here is a fast check against saved portraits and avatars. The authoritative check
			 * runs again under the same advisory lock when the image is saved. A presigned URL cannot
			 * write a permanent key, so discarding the reservation cannot free quota for an object that stays.
			 */
			prepare: Effect.fn("StorageService.prepare")(function* (input: PrepareImageInput) {
				yield* purgePendingObjects();

				const maxStored = input.purpose === "avatar" ? AVATAR_IMAGE_LIMITS.maxStoredBytes : CHARACTER_IMAGE_LIMITS.maxStoredBytes;
				if (input.bytes > maxStored) {
					return yield* new ImageUploadError("Image is too large to store.", 413);
				}

				const reserved = yield* transaction(
					Effect.fn(function* (tx) {
						yield* lockPortraitUser(tx, input.userId);

						if (input.purpose === "character") {
							const existing = yield* runQuery(
								tx.select({ userId: characters.userId }).from(characters).where(eq(characters.id, input.characterId)).limit(1)
							);
							const character = existing[0];
							if (character && character.userId !== input.userId) {
								return yield* new ImageUploadError("Character not found", 404);
							}

							yield* assertPortraitQuota(tx, input.userId, input.characterId, input.bytes);
						} else {
							yield* assertCustomAvatarAllowed(tx, input.userId);
							const [accountRow] = yield* runQuery(
								tx.select({ imageBytes: user.imageBytes }).from(user).where(eq(user.id, input.userId)).limit(1)
							);
							if (!accountRow) return yield* new ImageUploadError("Upload was not found", 404);
							yield* assertImageQuota(tx, input.userId, accountRow.imageBytes, input.bytes);
						}

						const [recent] = yield* runQuery(
							tx
								.select({ total: sql<number>`count(*)::int` })
								.from(characterImageUploads)
								.where(
									and(
										eq(characterImageUploads.userId, input.userId),
										gt(characterImageUploads.createdAt, new Date(Date.now() - CHARACTER_IMAGE_LIMITS.rateWindowMs))
									)
								)
						);
						if (integer(recent?.total) >= CHARACTER_IMAGE_LIMITS.maxUploadsPerWindow) {
							return yield* new ImageUploadError(
								`You can upload ${CHARACTER_IMAGE_LIMITS.maxUploadsPerWindow} images per hour. Try again later.`,
								429
							);
						}

						const uploadId = v7() as CharacterImageUploadId;
						const objectKey =
							input.purpose === "character"
								? temporaryCharacterImageKey(input.userId, input.characterId, uploadId, input.contentType)
								: temporaryAvatarImageKey(input.userId, uploadId, input.contentType);
						yield* runQuery(
							tx.insert(characterImageUploads).values({
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
			}),

			complete: Effect.fn("StorageService.complete")(function* (
				userId: UserId,
				uploadId: CharacterImageUploadId,
				purpose?: PrepareImageInput["purpose"]
			) {
				const found = yield* runQuery(
					db
						.select()
						.from(characterImageUploads)
						.where(and(eq(characterImageUploads.id, uploadId), eq(characterImageUploads.userId, userId)))
						.limit(1)
				);
				const upload = found[0];
				if (!upload || (purpose !== undefined && upload.purpose !== purpose)) {
					return yield* new ImageUploadError("Upload was not found", 404);
				}
				if (!isStoredImageContentType(upload.contentType)) {
					return yield* new ImageUploadError("The uploaded file did not match the allowed size or type.", 400);
				}

				const avatar =
					upload.purpose === "avatar" && upload.characterId === null && isOwnedTemporaryAvatarImageKey(userId, upload.objectKey);
				const portrait =
					upload.purpose === "character" &&
					upload.characterId !== null &&
					isOwnedTemporaryImageKey(userId, upload.characterId, upload.objectKey);
				if (!avatar && !portrait) return yield* new ImageUploadError("Upload was not found", 404);

				if (avatar) {
					yield* transaction(
						Effect.fn(function* (tx) {
							yield* assertCustomAvatarAllowed(tx, userId);
						})
					);
				}

				yield* verifyStoredObject(
					upload.objectKey,
					upload.bytes,
					upload.contentType,
					avatar ? AVATAR_IMAGE_LIMITS.maxStoredBytes : CHARACTER_IMAGE_LIMITS.maxStoredBytes
				);

				if (!upload.completedAt) {
					yield* runQuery(
						db.update(characterImageUploads).set({ completedAt: new Date() }).where(eq(characterImageUploads.id, upload.id))
					);
				}

				// `tmp/` objects are public on the image host until save copies them, or the lifecycle rule deletes them.
				return { imageUrl: imagePublicUrl(upload.objectKey, R2_PUBLIC_URL) };
			}),

			resolveForSave: Effect.fn("StorageService.resolveForSave")(function* (input: {
				userId: UserId;
				characterId: CharacterId;
				imageUrl: string;
			}) {
				const key = input.imageUrl ? keyFromPublicUrl(input.imageUrl, R2_PUBLIC_URL) : null;
				if (
					key &&
					(isTemporaryImageKey(key) || isPermanentImageKey(key)) &&
					!isTemporaryCharacterImageKey(key) &&
					!isPermanentCharacterImageKey(key)
				) {
					return yield* new ImageUploadError("Upload that image again before saving.");
				}
				if (key && (isTemporaryCharacterImageKey(key) || isPermanentCharacterImageKey(key))) {
					if (isOwnedTemporaryImageKey(input.userId, input.characterId, key)) {
						const permanent = permanentKeyForTemporary(key);
						if (!permanent) return yield* new ImageUploadError("Upload that image again before saving.");

						const rows = yield* runQuery(
							db
								.select()
								.from(characterImageUploads)
								.where(
									and(
										eq(characterImageUploads.objectKey, key),
										eq(characterImageUploads.userId, input.userId),
										eq(characterImageUploads.characterId, input.characterId)
									)
								)
								.limit(1)
						);
						const upload = rows[0];
						if (!upload || !isStoredImageContentType(upload.contentType)) {
							return yield* new ImageUploadError("Upload that image again before saving.");
						}

						return {
							owned: true,
							bytes: upload.bytes,
							imageUrl: imagePublicUrl(permanent, R2_PUBLIC_URL),
							copy: { from: key, to: permanent }
						} satisfies ResolvedCharacterImage;
					}

					const currentRows = yield* runQuery(
						db
							.select({ imageUrl: characters.imageUrl, imageBytes: characters.imageBytes })
							.from(characters)
							.where(and(eq(characters.id, input.characterId), eq(characters.userId, input.userId)))
							.limit(1)
					);
					const current = currentRows[0];
					const currentKey = current ? ownedPermanentKey(input.userId, input.characterId, current.imageUrl, R2_PUBLIC_URL) : null;
					if (current && currentKey && currentKey === key) {
						return {
							owned: true,
							bytes: current.imageBytes,
							imageUrl: imagePublicUrl(currentKey, R2_PUBLIC_URL),
							copy: null
						} satisfies ResolvedCharacterImage;
					}

					return yield* new ImageUploadError("Upload that image again before saving.");
				}

				return {
					owned: false,
					bytes: 0,
					imageUrl: input.imageUrl,
					copy: null
				} satisfies ResolvedCharacterImage;
			}),

			/**
			 * Deletes the staged object and any permanent objects queued by the save.
			 * Failures are logged. The owning row is already saved by the time this runs.
			 */
			cleanupAfterSave: cleanupSavedObject,

			/**
			 * Promotes a verified avatar from `tmp/` to its permanent key and stores it on the user.
			 * Closing the dialog without calling this leaves the staged object for the bucket lifecycle rule.
			 */
			saveAvatar: Effect.fn("StorageService.saveAvatar")(function* (userId: UserId, uploadId: CharacterImageUploadId) {
				let copiedKey: string | null = null;
				let tmpKey: string | null = null;

				const saved = yield* transaction(
					Effect.fn(function* (tx) {
						yield* lockPortraitUser(tx, userId);
						yield* assertCustomAvatarAllowed(tx, userId);

						const found = yield* runQuery(
							tx
								.select()
								.from(characterImageUploads)
								.where(
									and(
										eq(characterImageUploads.id, uploadId),
										eq(characterImageUploads.userId, userId),
										eq(characterImageUploads.purpose, "avatar")
									)
								)
								.limit(1)
						);
						const upload = found[0];
						if (
							!upload ||
							upload.characterId !== null ||
							!isTemporaryAvatarImageKey(upload.objectKey) ||
							!isOwnedTemporaryAvatarImageKey(userId, upload.objectKey) ||
							!isStoredImageContentType(upload.contentType)
						) {
							return yield* new ImageUploadError("Upload that image again before saving.");
						}

						const permanent = permanentImageKeyForTemporary(upload.objectKey);
						if (!permanent) return yield* new ImageUploadError("Upload that image again before saving.");

						const [current] = yield* runQuery(
							tx.select({ image: user.image, imageBytes: user.imageBytes }).from(user).where(eq(user.id, userId)).limit(1)
						);
						if (!current) return yield* new ImageUploadError("Upload was not found", 404);

						const previousKey = current.image ? ownedAvatarKey(userId, current.image, R2_PUBLIC_URL) : null;
						yield* assertImageQuota(tx, userId, current.imageBytes, upload.bytes);

						yield* copyVerifiedAvatar(tx, userId, { from: upload.objectKey, to: permanent });
						copiedKey = permanent;
						tmpKey = upload.objectKey;

						if (previousKey && previousKey !== permanent) yield* scheduleDeletions(tx, [previousKey]);
						yield* clearScheduledDeletions(tx, [permanent]);

						const promoted = yield* promoteAvatarUploadRow(tx, userId, permanent);
						if (!promoted) return yield* new ImageUploadError("Upload that image again before saving.");

						const imageUrl = imagePublicUrl(permanent, R2_PUBLIC_URL);
						const updated = yield* runQuery(
							tx
								.update(user)
								.set({ image: imageUrl, imageBytes: promoted.bytes })
								.where(eq(user.id, userId))
								.returning({ id: user.id })
						);
						if (!updated[0]) return yield* new ImageUploadError("Could not store the uploaded image.", 500);
						return { imageUrl };
					})
				).pipe(
					Effect.tapError(() => {
						const orphanKey = copiedKey;
						if (!orphanKey) return Effect.void;
						return abandonStagedObject(userId, orphanKey).pipe(
							Effect.catch((error) => AppLog.error("StorageService.saveAvatar staged cleanup", { message: error.message }))
						);
					})
				);

				yield* cleanupSavedObject(tmpKey);
				return saved;
			}),

			purgePending: Effect.fn("StorageService.purgePending")(function* () {
				yield* purgePendingObjects();
			}),

			abandonStagedObject
		};
	})()
}) {
	static readonly layer = Layer.effect(this, this.make);
}
