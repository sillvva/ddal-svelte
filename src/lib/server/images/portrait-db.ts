import { collectReferencedPermanentKeys } from "#lib/admin-storage.js";
import { PROVIDERS } from "#lib/constants.js";
import {
	imagePublicUrl,
	isPermanentCharacterImageKey,
	isPermanentImageKey,
	isPermanentNoteImageKey,
	ownedAvatarKey,
	ownedPermanentKey,
	TEMPORARY_IMAGE_PREFIX,
	userIdFromPermanentKey
} from "#lib/images/object-key.js";
import type { CharacterId, UserId } from "#lib/schemas.js";
import { runQuery, type Database, type Transaction } from "#lib/server/db/index.js";
import { characters, imageUploads, logImages, pendingObjectDeletions, user } from "#lib/server/db/schema.js";
import { ImageUploadError } from "#lib/server/images/errors.js";
import { R2_PUBLIC_URL } from "$app/env/public";
import { and, eq, exists, inArray, isNotNull, isNull, ne, notLike, or, sql } from "drizzle-orm";
import { Effect } from "effect";
import { v7 } from "uuid";

function integer(value: unknown) {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Serializes image storage quota updates, note image references, and avatar replacement for one account.
 * The lock id stays `character-image:` so both purposes take the same lock.
 */
export function lockPortraitUser(tx: Transaction, userId: UserId) {
	return Effect.tryPromise({
		try: () => tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`character-image:${userId}`}, 0))`),
		catch: (cause) => new ImageUploadError("Could not reserve storage", 500, cause)
	});
}

/** Acquires the portrait advisory lock for multiple users in sorted order in a single query. */
export function lockPortraitUsers(tx: Transaction, userIds: readonly UserId[]) {
	const unique = [...new Set(userIds)].sort();
	if (!unique.length) return Effect.void;
	const values = sql.join(
		unique.map((userId) => sql`(${`character-image:${userId}`})`),
		sql`, `
	);
	return Effect.tryPromise({
		try: () =>
			tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(v.lock_key, 0)) from (values ${values}) as v(lock_key)`),
		catch: (cause) => new ImageUploadError("Could not reserve storage", 500, cause)
	}).pipe(Effect.asVoid);
}

/**
 * Saved portrait bytes for one account.
 * Avatars are capped per object and are not included.
 * Presigned URLs only write `tmp/` objects, which are not counted.
 */
export function sumPortraitBytes(executor: Database | Transaction, userId: UserId) {
	return runQuery(
		executor
			.select({ total: sql<number>`coalesce(sum(${characters.imageBytes}), 0)::int` })
			.from(characters)
			.where(eq(characters.userId, userId))
	).pipe(Effect.map((rows) => integer(rows[0]?.total)));
}

/** Linked Google or Discord accounts own the profile image. Passkey-only accounts do not. */
export function assertCustomAvatarAllowed(tx: Transaction, userId: UserId) {
	return Effect.gen(function* () {
		const linked = yield* runQuery(
			tx.query.account.findFirst({
				columns: {
					id: true
				},
				where: {
					userId: { eq: userId },
					providerId: { in: PROVIDERS.map((provider) => provider.id) }
				}
			})
		);
		if (linked) {
			return yield* new ImageUploadError("Profile pictures from a linked sign-in provider can't be replaced here.", 403);
		}
	});
}

export function scheduleDeletions(tx: Transaction, keys: readonly string[]) {
	const unique = [...new Set(keys.filter(isPermanentImageKey))];
	if (!unique.length) return Effect.void;
	return runQuery(
		tx
			.insert(pendingObjectDeletions)
			.values(unique.map((objectKey) => ({ id: v7(), objectKey })))
			.onConflictDoNothing()
	).pipe(Effect.asVoid);
}

export function clearScheduledDeletions(tx: Transaction, keys: readonly string[]) {
	const unique = [...new Set(keys.filter(isPermanentImageKey))];
	if (!unique.length) return Effect.void;
	return runQuery(tx.delete(pendingObjectDeletions).where(inArray(pendingObjectDeletions.objectKey, unique))).pipe(Effect.asVoid);
}

export function permanentKeyInUse(tx: Transaction, key: string) {
	if (!isPermanentImageKey(key)) return Effect.succeed(false);
	const imageUrl = imagePublicUrl(key, R2_PUBLIC_URL);
	return Effect.gen(function* () {
		if (isPermanentNoteImageKey(key)) {
			const references = yield* runQuery(
				tx.query.logImages.findFirst({
					columns: {
						logId: true
					},
					where: {
						upload: {
							objectKey: { eq: key }
						}
					}
				})
			);
			return references ? true : false;
		}
		const portraits = yield* runQuery(
			tx.select({ id: characters.id }).from(characters).where(eq(characters.imageUrl, imageUrl)).limit(1)
		);
		if (portraits.length > 0) return true;
		const owners = yield* runQuery(tx.select({ id: user.id }).from(user).where(eq(user.image, imageUrl)).limit(1));
		return owners.length > 0;
	});
}

/**
 * Bytes to store for this save.
 * A new owned portrait must have an upload row issued for this user and character.
 * Unchanged portraits keep the bytes already recorded on the character.
 */
export function ownedBytesForSave(tx: Transaction, userId: UserId, characterId: CharacterId, imageUrl: string) {
	return Effect.gen(function* () {
		const current = yield* runQuery(
			tx.query.characters.findFirst({
				columns: {
					imageUrl: true,
					imageBytes: true,
					userId: true
				},
				where: {
					id: { eq: characterId }
				}
			})
		);
		if (current && current.userId !== userId) return yield* new ImageUploadError("Character not found", 404);

		const nextKey = ownedPermanentKey(userId, characterId, imageUrl, R2_PUBLIC_URL);
		const currentKey = current ? ownedPermanentKey(userId, characterId, current.imageUrl, R2_PUBLIC_URL) : null;

		if (nextKey && nextKey !== currentKey) {
			const promoted = yield* promoteUploadRow(tx, userId, characterId, nextKey);
			if (!promoted) return yield* ImageUploadError.reupload("The upload record for this image was not found.");
			return { bytes: promoted.bytes, nextKey, previousKey: currentKey };
		}

		if (nextKey) return { bytes: current?.imageBytes ?? 0, nextKey, previousKey: null };
		return { bytes: 0, nextKey: null, previousKey: currentKey };
	});
}

export function promoteAvatarUploadRow(tx: Transaction, userId: UserId, permanentKey: string) {
	const temporaryKey = `${TEMPORARY_IMAGE_PREFIX}${permanentKey}`;
	return runQuery(
		tx
			.update(imageUploads)
			.set({ objectKey: permanentKey, completedAt: new Date() })
			.where(
				and(
					eq(imageUploads.userId, userId),
					eq(imageUploads.purpose, "avatar"),
					isNull(imageUploads.characterId),
					or(eq(imageUploads.objectKey, permanentKey), eq(imageUploads.objectKey, temporaryKey))
				)
			)
			.returning({ bytes: imageUploads.bytes })
	).pipe(Effect.map((rows) => rows[0] ?? null));
}

export function promoteUploadRow(tx: Transaction, userId: UserId, characterId: CharacterId, permanentKey: string) {
	const temporaryKey = `${TEMPORARY_IMAGE_PREFIX}${permanentKey}`;
	return runQuery(
		tx
			.update(imageUploads)
			.set({ objectKey: permanentKey, completedAt: new Date() })
			.where(
				and(
					eq(imageUploads.userId, userId),
					eq(imageUploads.characterId, characterId),
					or(eq(imageUploads.objectKey, permanentKey), eq(imageUploads.objectKey, temporaryKey))
				)
			)
			.returning({ bytes: imageUploads.bytes })
	).pipe(Effect.map((rows) => rows[0] ?? null));
}

export function collectCharacterKeys(tx: Transaction, userId: UserId, characterId: CharacterId) {
	return Effect.gen(function* () {
		const character = yield* runQuery(
			tx.query.characters.findFirst({
				columns: {
					imageUrl: true
				},
				where: {
					id: { eq: characterId },
					userId: { eq: userId }
				}
			})
		);
		const uploads = yield* runQuery(
			tx.query.imageUploads.findMany({
				columns: {
					objectKey: true
				},
				where: {
					userId: { eq: userId },
					characterId: { eq: characterId }
				}
			})
		);
		const keys = new Set<string>();
		for (const upload of uploads) {
			if (isPermanentCharacterImageKey(upload.objectKey)) keys.add(upload.objectKey);
		}
		const current = character ? ownedPermanentKey(userId, characterId, character.imageUrl, R2_PUBLIC_URL) : null;
		if (current) keys.add(current);
		return [...keys];
	});
}

export function collectUserKeys(tx: Transaction, userId: UserId) {
	return Effect.gen(function* () {
		const portraits = yield* runQuery(
			tx.query.characters.findMany({
				columns: {
					id: true,
					imageUrl: true
				},
				where: {
					userId: { eq: userId }
				}
			})
		);
		const uploads = yield* runQuery(
			tx.query.imageUploads.findMany({
				columns: {
					objectKey: true
				},
				where: {
					userId: { eq: userId }
				}
			})
		);
		const account = yield* runQuery(
			tx.query.user.findFirst({
				columns: {
					image: true
				},
				where: {
					id: { eq: userId }
				}
			})
		);
		const keys = new Set<string>();
		for (const row of uploads) {
			if (isPermanentImageKey(row.objectKey)) keys.add(row.objectKey);
		}
		for (const portrait of portraits) {
			const key = ownedPermanentKey(userId, portrait.id, portrait.imageUrl, R2_PUBLIC_URL);
			if (key) keys.add(key);
		}
		if (account?.image) {
			const avatar = ownedAvatarKey(userId, account.image, R2_PUBLIC_URL);
			if (avatar) keys.add(avatar);
		}
		return [...keys];
	});
}

export function listPendingDeletions(executor: Database | Transaction, limit?: number) {
	return runQuery(
		executor.query.pendingObjectDeletions.findMany({
			columns: {
				id: true,
				objectKey: true,
				createdAt: true,
				attempts: true
			},
			orderBy: {
				createdAt: "asc"
			},
			...(limit !== undefined ? { limit } : {})
		})
	);
}

/**
 * Upload rows that still reference their object. Portrait and avatar uploads always do. A note upload only
 * does while a `log_image` row exists, so a promoted note image that lost its rows without being purged is an orphan.
 */
function uploadStillReferenced(executor: Database | Transaction) {
	return or(
		ne(imageUploads.purpose, "note"),
		exists(
			executor
				.select({ one: sql`1` })
				.from(logImages)
				.where(eq(logImages.uploadId, imageUploads.id))
		)
	);
}

/**
 * All permanent R2 keys currently referenced by `character.image_url`, `user.image`,
 * `image_upload.object_key` (note uploads only while a `log_image` row exists), or `pending_object_deletion.object_key`.
 */
export function listReferencedPermanentKeys(executor: Database | Transaction) {
	return Effect.gen(function* () {
		const characterRows = yield* runQuery(
			executor.select({ imageUrl: characters.imageUrl }).from(characters).where(ne(characters.imageUrl, ""))
		);
		const userRows = yield* runQuery(
			executor
				.select({ image: user.image })
				.from(user)
				.where(and(isNotNull(user.image), ne(user.image, "")))
		);
		const uploadRows = yield* runQuery(
			executor
				.select({ objectKey: imageUploads.objectKey })
				.from(imageUploads)
				.where(and(notLike(imageUploads.objectKey, `${TEMPORARY_IMAGE_PREFIX}%`), uploadStillReferenced(executor)))
		);
		const pendingRows = yield* runQuery(
			executor.select({ objectKey: pendingObjectDeletions.objectKey }).from(pendingObjectDeletions)
		);

		return collectReferencedPermanentKeys(
			{
				characterImageUrls: characterRows.map((row) => row.imageUrl),
				userImages: userRows.map((row) => row.image),
				imageUploadKeys: uploadRows.map((row) => row.objectKey),
				pendingDeletionKeys: pendingRows.map((row) => row.objectKey)
			},
			R2_PUBLIC_URL
		);
	});
}

/**
 * Re-checks which permanent keys from `keys` are currently referenced in the database.
 * Acquires the portrait advisory lock for every affected user first so in-flight saves commit before reading.
 */
export function findReferencedPermanentKeys(tx: Transaction, keys: readonly string[]) {
	const permanentKeys = [...new Set(keys.filter(isPermanentImageKey))];
	if (!permanentKeys.length) return Effect.succeed(new Set<string>());

	return Effect.gen(function* () {
		const userIds = permanentKeys.map(userIdForDeletion).filter((id): id is UserId => id !== null);
		yield* lockPortraitUsers(tx, userIds);

		const urls = permanentKeys.map((key) => imagePublicUrl(key, R2_PUBLIC_URL));

		const characterRows = yield* runQuery(
			tx.select({ imageUrl: characters.imageUrl }).from(characters).where(inArray(characters.imageUrl, urls))
		);
		const userRows = yield* runQuery(tx.select({ image: user.image }).from(user).where(inArray(user.image, urls)));
		const uploadRows = yield* runQuery(
			tx
				.select({ objectKey: imageUploads.objectKey })
				.from(imageUploads)
				.where(and(inArray(imageUploads.objectKey, permanentKeys), uploadStillReferenced(tx)))
		);
		const pendingRows = yield* runQuery(
			tx
				.select({ objectKey: pendingObjectDeletions.objectKey })
				.from(pendingObjectDeletions)
				.where(inArray(pendingObjectDeletions.objectKey, permanentKeys))
		);

		return collectReferencedPermanentKeys(
			{
				characterImageUrls: characterRows.map((row) => row.imageUrl),
				userImages: userRows.map((row) => row.image),
				imageUploadKeys: uploadRows.map((row) => row.objectKey),
				pendingDeletionKeys: pendingRows.map((row) => row.objectKey)
			},
			R2_PUBLIC_URL
		);
	});
}

export function lockPendingDeletion(tx: Transaction, objectKey: string) {
	return runQuery(
		tx
			.select({ id: pendingObjectDeletions.id, objectKey: pendingObjectDeletions.objectKey })
			.from(pendingObjectDeletions)
			.where(eq(pendingObjectDeletions.objectKey, objectKey))
			.limit(1)
			.for("update")
	).pipe(Effect.map((rows) => rows[0] ?? null));
}

export function removePendingDeletion(tx: Transaction, objectKey: string) {
	return runQuery(tx.delete(pendingObjectDeletions).where(eq(pendingObjectDeletions.objectKey, objectKey))).pipe(Effect.asVoid);
}

export function notePendingFailure(tx: Transaction, objectKey: string) {
	return runQuery(
		tx
			.update(pendingObjectDeletions)
			.set({ attempts: sql`${pendingObjectDeletions.attempts} + 1` })
			.where(eq(pendingObjectDeletions.objectKey, objectKey))
	).pipe(Effect.asVoid);
}

export function userIdForDeletion(key: string) {
	const userId = userIdFromPermanentKey(key);
	return userId ? (userId as UserId) : null;
}
