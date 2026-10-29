import { PROVIDERS } from "#lib/constants.js";
import { CHARACTER_IMAGE_LIMITS } from "#lib/images/limits.js";
import {
	imagePublicUrl,
	isPermanentCharacterImageKey,
	isPermanentImageKey,
	ownedAvatarKey,
	ownedPermanentKey,
	TEMPORARY_IMAGE_PREFIX,
	userIdFromPermanentKey
} from "#lib/images/object-key.js";
import type { CharacterId, UserId } from "#lib/schemas.js";
import { runQuery, type Database, type Transaction } from "#lib/server/db/index.js";
import { account, imageUploads, characters, pendingObjectDeletions, user } from "#lib/server/db/schema.js";
import { ImageUploadError } from "#lib/server/images/errors.js";
import { R2_PUBLIC_URL } from "$app/env/public";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { Effect } from "effect";
import { v7 } from "uuid";

function integer(value: unknown) {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Serializes portrait quota updates and avatar replacement for one account.
 * The lock id stays `character-image:` so both purposes take the same lock.
 */
export function lockPortraitUser(tx: Transaction, userId: UserId) {
	return Effect.tryPromise({
		try: () => tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`character-image:${userId}`}, 0))`),
		catch: (cause) => new ImageUploadError("Could not reserve storage", 500, cause)
	});
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

/**
 * Quota is the sum of `character.image_bytes` for saved portraits.
 * The check runs under `lockPortraitUser`, in the same transaction that updates `image_bytes`.
 */
export function assertPortraitQuota(tx: Transaction, userId: UserId, characterId: CharacterId, nextBytes: number) {
	return Effect.gen(function* () {
		const used = yield* sumPortraitBytes(tx, userId);
		const [current] = yield* runQuery(
			tx
				.select({ imageBytes: characters.imageBytes })
				.from(characters)
				.where(and(eq(characters.id, characterId), eq(characters.userId, userId)))
				.limit(1)
		);
		const credit = current?.imageBytes ?? 0;
		if (nextBytes > credit && used - credit + nextBytes > CHARACTER_IMAGE_LIMITS.quotaBytes) {
			return yield* new ImageUploadError("This image would exceed your 20 MB storage limit.", 413);
		}
	});
}

/** Linked Google or Discord accounts own the profile image. Passkey-only accounts do not. */
export function assertCustomAvatarAllowed(tx: Transaction, userId: UserId) {
	return Effect.gen(function* () {
		const linked = yield* runQuery(
			tx
				.select({ id: account.id })
				.from(account)
				.where(
					and(
						eq(account.userId, userId),
						inArray(
							account.providerId,
							PROVIDERS.map((provider) => provider.id)
						)
					)
				)
				.limit(1)
		);
		if (linked.length > 0) {
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
		const existing = yield* runQuery(
			tx
				.select({
					imageUrl: characters.imageUrl,
					imageBytes: characters.imageBytes,
					userId: characters.userId
				})
				.from(characters)
				.where(eq(characters.id, characterId))
				.limit(1)
		);
		const current = existing[0];
		if (current && current.userId !== userId) return yield* new ImageUploadError("Character not found", 404);

		const nextKey = ownedPermanentKey(userId, characterId, imageUrl, R2_PUBLIC_URL);
		const currentKey = current ? ownedPermanentKey(userId, characterId, current.imageUrl, R2_PUBLIC_URL) : null;

		if (nextKey && nextKey !== currentKey) {
			const promoted = yield* promoteUploadRow(tx, userId, characterId, nextKey);
			if (!promoted) return yield* new ImageUploadError("Upload that image again before saving.");
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
		const characterRows = yield* runQuery(
			tx
				.select({ imageUrl: characters.imageUrl })
				.from(characters)
				.where(and(eq(characters.id, characterId), eq(characters.userId, userId)))
				.limit(1)
		);
		const uploads = yield* runQuery(
			tx
				.select({ objectKey: imageUploads.objectKey })
				.from(imageUploads)
				.where(and(eq(imageUploads.userId, userId), eq(imageUploads.characterId, characterId)))
		);
		const keys = new Set<string>();
		for (const row of uploads) {
			if (isPermanentCharacterImageKey(row.objectKey)) keys.add(row.objectKey);
		}
		const current = characterRows[0] ? ownedPermanentKey(userId, characterId, characterRows[0].imageUrl, R2_PUBLIC_URL) : null;
		if (current) keys.add(current);
		return [...keys];
	});
}

export function collectUserKeys(tx: Transaction, userId: UserId) {
	return Effect.gen(function* () {
		const portraits = yield* runQuery(
			tx.select({ id: characters.id, imageUrl: characters.imageUrl }).from(characters).where(eq(characters.userId, userId))
		);
		const uploads = yield* runQuery(
			tx.select({ objectKey: imageUploads.objectKey }).from(imageUploads).where(eq(imageUploads.userId, userId))
		);
		const [accountRow] = yield* runQuery(tx.select({ image: user.image }).from(user).where(eq(user.id, userId)).limit(1));
		const keys = new Set<string>();
		for (const row of uploads) {
			if (isPermanentImageKey(row.objectKey)) keys.add(row.objectKey);
		}
		for (const portrait of portraits) {
			const key = ownedPermanentKey(userId, portrait.id, portrait.imageUrl, R2_PUBLIC_URL);
			if (key) keys.add(key);
		}
		if (accountRow?.image) {
			const avatar = ownedAvatarKey(userId, accountRow.image, R2_PUBLIC_URL);
			if (avatar) keys.add(avatar);
		}
		return [...keys];
	});
}

export function listPendingDeletions(tx: Transaction, limit: number) {
	return runQuery(
		tx
			.select({
				id: pendingObjectDeletions.id,
				objectKey: pendingObjectDeletions.objectKey
			})
			.from(pendingObjectDeletions)
			.orderBy(pendingObjectDeletions.createdAt)
			.limit(limit)
	);
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
