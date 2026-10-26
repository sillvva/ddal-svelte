import { extensionForStoredImage, isOwnedCharacterImageKey } from "#lib/images/object-key.js";
import { CHARACTER_IMAGE_LIMITS, type StoredImageContentType } from "#lib/images/limits.js";
import type { CharacterId, CharacterImageUploadId, UserId } from "#lib/schemas.js";
import { runQuery, type Transaction } from "#lib/server/db/index.js";
import { DBService } from "#lib/server/db/index.js";
import { characterImageUploads, characters } from "#lib/server/db/schema.js";
import type { ErrorParams } from "#lib/server/effect/errors.js";
import { AppLog } from "#lib/server/effect/logging.js";
import {
	DeleteObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
	type HeadObjectCommandOutput
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { R2_ACCESS_KEY_ID, R2_BUCKET, R2_ENDPOINT, R2_SECRET_ACCESS_KEY } from "$app/env/private";
import { R2_PUBLIC_URL } from "$app/env/public";
import { and, eq, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { Context, Data, Effect, Layer } from "effect";
import { v7 } from "uuid";

export class ImageUploadError extends Data.TaggedError("ImageUploadError")<ErrorParams> {
	constructor(message: string, status: ErrorParams["status"] = 400, cause?: unknown) {
		super({ message, status, cause });
	}
}

interface PrepareImageInput {
	userId: UserId;
	characterId: CharacterId;
	contentType: StoredImageContentType;
	bytes: number;
}

interface SaveImageInput {
	userId: UserId;
	characterId: CharacterId;
	imageUrl: string;
	previousImageUrl?: string;
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

function imagePublicUrl(key: string) {
	const base = new URL(R2_PUBLIC_URL);
	const prefix = base.pathname.replace(/\/$/, "");
	const encoded = key.split("/").map(encodeURIComponent).join("/");
	return `${base.origin}${prefix}/${encoded}`;
}

function keyFromImageUrl(imageUrl: string) {
	let url: URL;
	try {
		url = new URL(imageUrl);
	} catch {
		return null;
	}

	const base = new URL(R2_PUBLIC_URL);
	if (url.origin !== base.origin) return null;

	const prefix = base.pathname.replace(/\/$/, "");
	let path: string;
	try {
		path = decodeURIComponent(url.pathname);
	} catch {
		return null;
	}
	if (prefix && path !== prefix && !path.startsWith(`${prefix}/`)) return null;

	const key = path.slice(prefix.length).replace(/^\//, "");
	if (!key || key.includes("..")) return null;
	return key;
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

function contentTypeOf(key: string): StoredImageContentType {
	return key.endsWith(".jpg") ? "image/jpeg" : "image/webp";
}

function ownedImageKey(userId: UserId, characterId: CharacterId, imageUrl: string) {
	const key = keyFromImageUrl(imageUrl);
	if (!key || !isOwnedCharacterImageKey(userId, characterId, key)) return null;
	return key;
}

export class StorageService extends Context.Service<StorageService>()("StorageService", {
	make: Effect.fn("StorageService")(function* () {
		const { db, transaction } = yield* DBService;

		const deleteObject = Effect.fn("StorageService.deleteObject")(function* (userId: UserId, key: string) {
			if (!key.startsWith(`users/${userId}/`) || key.includes("..")) {
				return yield* new ImageUploadError("Refusing to delete an object outside this account", 500);
			}

			yield* Effect.tryPromise({
				try: async () => {
					try {
						await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
					} catch (cause) {
						if (!isMissingObject(cause)) throw cause;
					}
				},
				catch: (cause) => new ImageUploadError("Could not delete the replaced image", 500, cause)
			});
		});

		const markRemoved = Effect.fn("StorageService.markRemoved")(function* (userId: UserId, key: string) {
			yield* runQuery(
				db
					.update(characterImageUploads)
					.set({ removedAt: new Date() })
					.where(and(eq(characterImageUploads.userId, userId), eq(characterImageUploads.objectKey, key)))
			);
		});

		const removeObjects = Effect.fn("StorageService.removeObjects")(function* (userId: UserId, keys: Iterable<string>) {
			for (const key of keys) {
				yield* deleteObject(userId, key);
				yield* markRemoved(userId, key);
			}
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

		const signPut = Effect.fn("StorageService.signPut")(function* (
			key: string,
			contentType: StoredImageContentType,
			bytes: number
		) {
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

		const lockUser = (tx: Transaction, userId: UserId) =>
			Effect.tryPromise({
				try: () => tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`character-image:${userId}`}, 0))`),
				catch: (cause) => new ImageUploadError("Could not reserve storage", 500, cause)
			});

		const integer = (value: unknown) => {
			const parsed = Number(value ?? 0);
			return Number.isFinite(parsed) ? parsed : 0;
		};

		/**
		 * Marks expired reservations and retries object deletes for rows already discarded.
		 * Returns keys whose objects should be removed after the transaction commits.
		 */
		const sweep = Effect.fn("StorageService.sweep")(function* (tx: Transaction, userId: UserId) {
			const now = Date.now();
			const pendingCutoff = new Date(now - CHARACTER_IMAGE_LIMITS.pendingTtlMs);
			const staleCutoff = new Date(now - CHARACTER_IMAGE_LIMITS.unattachedTtlMs);
			const keys = new Set<string>();

			const expired = yield* runQuery(
				tx
					.select({ objectKey: characterImageUploads.objectKey })
					.from(characterImageUploads)
					.where(
						and(
							eq(characterImageUploads.userId, userId),
							isNull(characterImageUploads.discardedAt),
							isNull(characterImageUploads.completedAt),
							lt(characterImageUploads.createdAt, pendingCutoff)
						)
					)
			);
			const expiredKeys = expired.map((row) => row.objectKey);

			if (expiredKeys.length) {
				yield* runQuery(
					tx
						.update(characterImageUploads)
						.set({ discardedAt: new Date() })
						.where(and(eq(characterImageUploads.userId, userId), inArray(characterImageUploads.objectKey, expiredKeys)))
				);
				for (const key of expiredKeys) keys.add(key);
			}

			const loose = yield* runQuery(
				tx
					.select({
						objectKey: characterImageUploads.objectKey,
						createdAt: characterImageUploads.createdAt,
						imageUrl: characters.imageUrl
					})
					.from(characterImageUploads)
					.leftJoin(characters, eq(characters.id, characterImageUploads.characterId))
					.where(
						and(
							eq(characterImageUploads.userId, userId),
							isNull(characterImageUploads.discardedAt),
							eq(characterImageUploads.attached, false),
							isNotNull(characterImageUploads.completedAt)
						)
					)
			);

			const staleKeys: string[] = [];
			const adoptKeys: string[] = [];
			for (const row of loose) {
				const current = row.imageUrl ? keyFromImageUrl(row.imageUrl) : null;
				if (current === row.objectKey) adoptKeys.push(row.objectKey);
				else if (row.createdAt < staleCutoff) staleKeys.push(row.objectKey);
			}

			if (adoptKeys.length) {
				yield* runQuery(
					tx
						.update(characterImageUploads)
						.set({ attached: true, discardedAt: null })
						.where(and(eq(characterImageUploads.userId, userId), inArray(characterImageUploads.objectKey, adoptKeys)))
				);
			}

			if (staleKeys.length) {
				yield* runQuery(
					tx
						.update(characterImageUploads)
						.set({ discardedAt: new Date(), attached: false })
						.where(and(eq(characterImageUploads.userId, userId), inArray(characterImageUploads.objectKey, staleKeys)))
				);
				for (const key of staleKeys) keys.add(key);
			}

			const orphans = yield* runQuery(
				tx
					.select({ objectKey: characterImageUploads.objectKey })
					.from(characterImageUploads)
					.leftJoin(characters, eq(characters.id, characterImageUploads.characterId))
					.where(
						and(
							eq(characterImageUploads.userId, userId),
							isNull(characterImageUploads.discardedAt),
							eq(characterImageUploads.attached, true),
							isNull(characters.id)
						)
					)
			);
			const orphanKeys = orphans.map((row) => row.objectKey);
			if (orphanKeys.length) {
				yield* runQuery(
					tx
						.update(characterImageUploads)
						.set({ discardedAt: new Date(), attached: false })
						.where(and(eq(characterImageUploads.userId, userId), inArray(characterImageUploads.objectKey, orphanKeys)))
				);
				for (const key of orphanKeys) keys.add(key);
			}

			const leftover = yield* runQuery(
				tx
					.select({ objectKey: characterImageUploads.objectKey })
					.from(characterImageUploads)
					.where(
						and(
							eq(characterImageUploads.userId, userId),
							isNotNull(characterImageUploads.discardedAt),
							isNull(characterImageUploads.removedAt)
						)
					)
			);
			for (const row of leftover) keys.add(row.objectKey);

			return [...keys];
		});

		const reservedBytes = (tx: Transaction, userId: UserId, characterId?: CharacterId) =>
			runQuery(
				tx
					.select({ total: sql<number>`coalesce(sum(${characterImageUploads.bytes}), 0)::int` })
					.from(characterImageUploads)
					.where(
						and(
							eq(characterImageUploads.userId, userId),
							isNull(characterImageUploads.discardedAt),
							eq(characterImageUploads.attached, false),
							...(characterId ? [eq(characterImageUploads.characterId, characterId)] : []),
							or(
								isNotNull(characterImageUploads.completedAt),
								gt(characterImageUploads.createdAt, new Date(Date.now() - CHARACTER_IMAGE_LIMITS.pendingTtlMs))
							)
						)
					)
			).pipe(Effect.map((rows) => integer(rows[0]?.total)));

		const rememberDeletion = (tx: Transaction, userId: UserId, characterId: CharacterId, key: string) =>
			runQuery(
				tx
					.insert(characterImageUploads)
					.values({
						id: v7() as CharacterImageUploadId,
						userId,
						characterId,
						objectKey: key,
						bytes: 1,
						contentType: contentTypeOf(key),
						completedAt: new Date(),
						attached: false,
						discardedAt: new Date()
					})
					.onConflictDoUpdate({
						target: characterImageUploads.objectKey,
						set: {
							discardedAt: new Date(),
							attached: false,
							removedAt: null,
							characterId,
							userId
						}
					})
			);

		return {
			prepare: Effect.fn("StorageService.prepare")(function* (input: PrepareImageInput) {
				if (input.bytes > CHARACTER_IMAGE_LIMITS.maxStoredBytes) {
					return yield* new ImageUploadError("Image is too large to store.", 413);
				}

				const reserved = yield* transaction(
					Effect.fn(function* (tx) {
						yield* lockUser(tx, input.userId);
						const staleKeys = yield* sweep(tx, input.userId);

						const existing = yield* runQuery(
							tx
								.select({
									userId: characters.userId,
									imageBytes: characters.imageBytes
								})
								.from(characters)
								.where(eq(characters.id, input.characterId))
								.limit(1)
						);
						const character = existing[0];
						if (character && character.userId !== input.userId) {
							return yield* new ImageUploadError("Character not found", 404);
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

						const [stored] = yield* runQuery(
							tx
								.select({ total: sql<number>`coalesce(sum(${characters.imageBytes}), 0)::int` })
								.from(characters)
								.where(eq(characters.userId, input.userId))
						);
						const reservedTotal = yield* reservedBytes(tx, input.userId);
						const reservedForCharacter = yield* reservedBytes(tx, input.userId, input.characterId);
						const credit = (character?.imageBytes ?? 0) + reservedForCharacter;
						const used = Math.max(0, integer(stored?.total) + reservedTotal - credit);
						if (used + input.bytes > CHARACTER_IMAGE_LIMITS.quotaBytes) {
							return yield* new ImageUploadError("This image would exceed your 20 MB storage limit.", 413);
						}

						const uploadId = v7() as CharacterImageUploadId;
						const objectKey = `users/${input.userId}/characters/${input.characterId}/${uploadId}.${extensionForStoredImage(input.contentType)}`;
						yield* runQuery(
							tx.insert(characterImageUploads).values({
								id: uploadId,
								userId: input.userId,
								characterId: input.characterId,
								objectKey,
								bytes: input.bytes,
								contentType: input.contentType
							})
						);

						return { uploadId, objectKey, staleKeys };
					})
				);

				yield* removeObjects(input.userId, reserved.staleKeys).pipe(
					Effect.catch((error) => AppLog.error("StorageService.prepare.sweep", { message: error.message }))
				);

				const uploadUrl = yield* signPut(reserved.objectKey, input.contentType, input.bytes).pipe(
					Effect.tapError(() =>
						runQuery(
							db
								.update(characterImageUploads)
								.set({ discardedAt: new Date(), removedAt: new Date() })
								.where(eq(characterImageUploads.id, reserved.uploadId))
						)
					)
				);

				return {
					uploadId: reserved.uploadId,
					uploadUrl,
					contentType: input.contentType
				};
			}),

			complete: Effect.fn("StorageService.complete")(function* (userId: UserId, uploadId: CharacterImageUploadId) {
				const found = yield* runQuery(
					db
						.select()
						.from(characterImageUploads)
						.where(and(eq(characterImageUploads.id, uploadId), eq(characterImageUploads.userId, userId)))
						.limit(1)
				);
				const upload = found[0];
				if (!upload) return yield* new ImageUploadError("Upload was not found", 404);
				if (upload.discardedAt) return yield* new ImageUploadError("That upload expired. Choose the image again.", 400);

				if (!upload.completedAt) {
					if (upload.createdAt.getTime() + CHARACTER_IMAGE_LIMITS.pendingTtlMs < Date.now()) {
						yield* runQuery(
							db.update(characterImageUploads).set({ discardedAt: new Date() }).where(eq(characterImageUploads.id, upload.id))
						);
						yield* removeObjects(userId, [upload.objectKey]).pipe(Effect.catch(() => Effect.void));
						return yield* new ImageUploadError("That upload expired. Choose the image again.", 400);
					}

					const head = yield* headObject(upload.objectKey).pipe(
						Effect.tapError((error) =>
							error.status === 400
								? runQuery(
										db
											.update(characterImageUploads)
											.set({ discardedAt: new Date(), removedAt: new Date() })
											.where(eq(characterImageUploads.id, upload.id))
									).pipe(Effect.asVoid)
								: Effect.void
						)
					);
					const actualType = head.ContentType?.split(";")[0]?.trim().toLowerCase();
					if (head.ContentLength !== upload.bytes || actualType !== upload.contentType) {
						yield* runQuery(
							db.update(characterImageUploads).set({ discardedAt: new Date() }).where(eq(characterImageUploads.id, upload.id))
						);
						yield* removeObjects(userId, [upload.objectKey]).pipe(Effect.catch(() => Effect.void));
						return yield* new ImageUploadError("The uploaded file did not match the allowed size or type.", 400);
					}
				}

				const finished = yield* transaction(
					Effect.fn(function* (tx) {
						yield* lockUser(tx, userId);
						const staleKeys = yield* sweep(tx, userId);
						const currentRows = yield* runQuery(
							tx
								.select()
								.from(characterImageUploads)
								.where(and(eq(characterImageUploads.id, uploadId), eq(characterImageUploads.userId, userId)))
								.limit(1)
						);
						const current = currentRows[0];
						if (!current || current.discardedAt) {
							return yield* new ImageUploadError("That upload expired. Choose the image again.", 400);
						}

						const imageUrl = imagePublicUrl(current.objectKey);
						if (current.completedAt) return { imageUrl, keys: staleKeys };

						const portrait = yield* runQuery(
							tx
								.select({ imageUrl: characters.imageUrl })
								.from(characters)
								.where(and(eq(characters.id, current.characterId), eq(characters.userId, userId)))
								.limit(1)
						);
						// The saved portrait stays until the form is submitted. Only earlier unsaved uploads are replaced.
						const savedKey = portrait[0] ? ownedImageKey(userId, current.characterId, portrait[0].imageUrl) : null;

						yield* runQuery(
							tx
								.update(characterImageUploads)
								.set({
									completedAt: new Date(),
									attached: false,
									discardedAt: null
								})
								.where(eq(characterImageUploads.id, current.id))
						);

						const replaced = yield* runQuery(
							tx
								.update(characterImageUploads)
								.set({ discardedAt: new Date(), attached: false })
								.where(
									and(
										eq(characterImageUploads.userId, userId),
										eq(characterImageUploads.characterId, current.characterId),
										ne(characterImageUploads.id, current.id),
										isNull(characterImageUploads.discardedAt),
										...(savedKey ? [ne(characterImageUploads.objectKey, savedKey)] : [])
									)
								)
								.returning({ objectKey: characterImageUploads.objectKey })
						);

						const keys = new Set(
							[...staleKeys, ...replaced.map((row) => row.objectKey)].filter(
								(key) => key !== current.objectKey && key !== savedKey
							)
						);

						return { imageUrl, keys: [...keys] };
					})
				);

				yield* removeObjects(userId, finished.keys).pipe(
					Effect.catch((error) => AppLog.error("StorageService.complete.cleanup", { message: error.message }))
				);

				return { imageUrl: finished.imageUrl };
			}),

			resolveForSave: Effect.fn("StorageService.resolveForSave")(function* (input: Omit<SaveImageInput, "previousImageUrl">) {
				const key = keyFromImageUrl(input.imageUrl);
				if (!input.imageUrl || !key || !isOwnedCharacterImageKey(input.userId, input.characterId, key)) {
					return { owned: false as const, bytes: 0 };
				}

				const rows = yield* runQuery(
					db
						.select()
						.from(characterImageUploads)
						.where(and(eq(characterImageUploads.objectKey, key), eq(characterImageUploads.userId, input.userId)))
						.limit(1)
				);
				const upload = rows[0];
				if (!upload || upload.discardedAt || !upload.completedAt || upload.characterId !== input.characterId) {
					return yield* new ImageUploadError("Upload that image again before saving.");
				}

				const head: HeadObjectCommandOutput = yield* headObject(key);
				if (head.ContentLength !== upload.bytes) {
					return yield* new ImageUploadError("The uploaded image could not be verified. Upload it again.");
				}

				return { owned: true, bytes: upload.bytes };
			}),

			finalizeSavedImage: Effect.fn("StorageService.finalizeSavedImage")(function* (input: SaveImageInput) {
				const keep = ownedImageKey(input.userId, input.characterId, input.imageUrl);
				const previous = input.previousImageUrl ? ownedImageKey(input.userId, input.characterId, input.previousImageUrl) : null;

				const keys = yield* transaction(
					Effect.fn(function* (tx) {
						yield* lockUser(tx, input.userId);
						const staleKeys = yield* sweep(tx, input.userId);
						const removing = new Set(staleKeys);

						if (previous && previous !== keep) removing.add(previous);

						const others = yield* runQuery(
							tx
								.select({ objectKey: characterImageUploads.objectKey })
								.from(characterImageUploads)
								.where(
									and(
										eq(characterImageUploads.userId, input.userId),
										eq(characterImageUploads.characterId, input.characterId),
										isNull(characterImageUploads.discardedAt),
										...(keep ? [ne(characterImageUploads.objectKey, keep)] : [])
									)
								)
						);
						for (const row of others) removing.add(row.objectKey);
						if (keep) removing.delete(keep);

						for (const key of removing) {
							yield* rememberDeletion(tx, input.userId, input.characterId, key);
						}

						if (keep) {
							yield* runQuery(
								tx
									.update(characterImageUploads)
									.set({ attached: true, discardedAt: null, removedAt: null })
									.where(and(eq(characterImageUploads.userId, input.userId), eq(characterImageUploads.objectKey, keep)))
							);
						}

						return [...removing];
					})
				);

				yield* removeObjects(input.userId, keys);
			}),

			/**
			 * Deletes every stored object for a character after the character row is gone.
			 * Keys must be collected before the row is deleted.
			 */
			releaseCharacter: Effect.fn("StorageService.releaseCharacter")(function* (
				userId: UserId,
				characterId: CharacterId,
				keys: string[]
			) {
				const owned = keys.filter((key) => isOwnedCharacterImageKey(userId, characterId, key));
				yield* transaction(
					Effect.fn(function* (tx) {
						yield* lockUser(tx, userId);
						yield* runQuery(
							tx
								.update(characterImageUploads)
								.set({ discardedAt: new Date(), attached: false })
								.where(
									and(
										eq(characterImageUploads.userId, userId),
										eq(characterImageUploads.characterId, characterId),
										isNull(characterImageUploads.discardedAt)
									)
								)
						);
						for (const key of owned) yield* rememberDeletion(tx, userId, characterId, key);
					})
				);
				yield* removeObjects(userId, owned).pipe(
					Effect.catch((error) => AppLog.error("StorageService.releaseCharacter", { message: error.message }))
				);
			}),

			collectCharacterKeys: Effect.fn("StorageService.collectCharacterKeys")(function* (
				userId: UserId,
				characterId: CharacterId
			) {
				const characterRows = yield* runQuery(
					db
						.select({ imageUrl: characters.imageUrl, userId: characters.userId })
						.from(characters)
						.where(and(eq(characters.id, characterId), eq(characters.userId, userId)))
						.limit(1)
				);
				const uploads = yield* runQuery(
					db
						.select({ objectKey: characterImageUploads.objectKey })
						.from(characterImageUploads)
						.where(and(eq(characterImageUploads.userId, userId), eq(characterImageUploads.characterId, characterId)))
				);
				const keys = new Set(uploads.map((row) => row.objectKey));
				const imageUrl = characterRows[0]?.imageUrl;
				const current = imageUrl ? ownedImageKey(userId, characterId, imageUrl) : null;
				if (current) keys.add(current);
				return [...keys];
			}),

			/** Object keys for every portrait this account has stored. Collect these before deleting the user. */
			collectUserKeys: Effect.fn("StorageService.collectUserKeys")(function* (userId: UserId) {
				const portraits = yield* runQuery(
					db.select({ id: characters.id, imageUrl: characters.imageUrl }).from(characters).where(eq(characters.userId, userId))
				);
				const uploads = yield* runQuery(
					db
						.select({ objectKey: characterImageUploads.objectKey })
						.from(characterImageUploads)
						.where(eq(characterImageUploads.userId, userId))
				);
				const keys = new Set(uploads.map((row) => row.objectKey));
				for (const portrait of portraits) {
					const key = ownedImageKey(userId, portrait.id, portrait.imageUrl);
					if (key) keys.add(key);
				}
				return [...keys];
			}),

			purgeKeys: Effect.fn("StorageService.purgeKeys")(function* (userId: UserId, keys: string[]) {
				yield* removeObjects(userId, keys).pipe(
					Effect.catch((error) => AppLog.error("StorageService.purgeKeys", { message: error.message }))
				);
			}),

			/**
			 * Deletes an upload that was never saved. A portrait already stored on the character is left in place.
			 */
			releaseUnsaved: Effect.fn("StorageService.releaseUnsaved")(function* (userId: UserId, uploadId: CharacterImageUploadId) {
				const objectKey = yield* transaction(
					Effect.fn(function* (tx) {
						yield* lockUser(tx, userId);
						const rows = yield* runQuery(
							tx
								.select()
								.from(characterImageUploads)
								.where(and(eq(characterImageUploads.id, uploadId), eq(characterImageUploads.userId, userId)))
								.limit(1)
						);
						const upload = rows[0];
						if (!upload || upload.discardedAt || upload.attached) return null;

						const portrait = yield* runQuery(
							tx
								.select({ imageUrl: characters.imageUrl })
								.from(characters)
								.where(and(eq(characters.id, upload.characterId), eq(characters.userId, userId)))
								.limit(1)
						);
						const savedKey = portrait[0] ? ownedImageKey(userId, upload.characterId, portrait[0].imageUrl) : null;
						if (savedKey === upload.objectKey) return null;

						yield* runQuery(
							tx
								.update(characterImageUploads)
								.set({ discardedAt: new Date(), attached: false })
								.where(eq(characterImageUploads.id, upload.id))
						);
						return upload.objectKey;
					})
				);

				if (!objectKey) return;
				yield* removeObjects(userId, [objectKey]).pipe(
					Effect.catch((error) => AppLog.error("StorageService.releaseUnsaved", { message: error.message }))
				);
			})
		};
	})()
}) {
	static readonly layer = Layer.effect(this, this.make);
}
