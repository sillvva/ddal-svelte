import type { StoredImageContentType } from "#lib/images/limits.js";

const uploadFilePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$/iu;

/**
 * Unsaved browser uploads live under this prefix.
 * An R2 lifecycle rule (configured on the bucket, not by the app) deletes them after about a day.
 */
export const TEMPORARY_IMAGE_PREFIX = "tmp/";

const permanentKeyPattern =
	/^users\/[0-9a-f-]{36}\/characters\/[0-9a-f-]{36}\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$/iu;

const permanentAvatarKeyPattern =
	/^users\/[0-9a-f-]{36}\/avatar\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$/iu;

const permanentNoteKeyPattern =
	/^users\/[0-9a-f-]{36}\/notes\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$/iu;

/** Storage prefix (with trailing slash) for a character's permanent portrait images. */
export function characterImagePrefix(userId: string, characterId: string) {
	return `users/${userId}/characters/${characterId}/`;
}

/** File extension for a stored image content type. `image/webp` maps to `webp`; anything else maps to `jpg`. */
export function extensionForStoredImage(contentType: StoredImageContentType) {
	return contentType === "image/webp" ? "webp" : "jpg";
}

/** Permanent storage key for a character portrait, built from the upload id and the content type's extension. */
export function permanentCharacterImageKey(
	userId: string,
	characterId: string,
	uploadId: string,
	contentType: StoredImageContentType
) {
	return `${characterImagePrefix(userId, characterId)}${uploadId}.${extensionForStoredImage(contentType)}`;
}

/** Temporary (`tmp/`-prefixed) storage key for a character portrait that has not been saved yet. */
export function temporaryCharacterImageKey(
	userId: string,
	characterId: string,
	uploadId: string,
	contentType: StoredImageContentType
) {
	return `${TEMPORARY_IMAGE_PREFIX}${permanentCharacterImageKey(userId, characterId, uploadId, contentType)}`;
}

/** Whether `key` matches the permanent character portrait key shape and contains no `..` segments. */
export function isPermanentCharacterImageKey(key: string) {
	return permanentKeyPattern.test(key) && !key.includes("..");
}

/** Whether `key` is a `tmp/` prefixed key whose remainder is a valid permanent character portrait key. */
export function isTemporaryCharacterImageKey(key: string) {
	return key.startsWith(TEMPORARY_IMAGE_PREFIX) && isPermanentCharacterImageKey(key.slice(TEMPORARY_IMAGE_PREFIX.length));
}

/** Storage prefix (with trailing slash) for a user's avatar images. */
export function avatarImagePrefix(userId: string) {
	return `users/${userId}/avatar/`;
}

/** Permanent storage key for a user's avatar, built from the upload id and the content type's extension. */
export function permanentAvatarImageKey(userId: string, uploadId: string, contentType: StoredImageContentType) {
	return `${avatarImagePrefix(userId)}${uploadId}.${extensionForStoredImage(contentType)}`;
}

/** Temporary (`tmp/`-prefixed) storage key for an avatar that has not been saved yet. */
export function temporaryAvatarImageKey(userId: string, uploadId: string, contentType: StoredImageContentType) {
	return `${TEMPORARY_IMAGE_PREFIX}${permanentAvatarImageKey(userId, uploadId, contentType)}`;
}

/** Whether `key` matches the permanent avatar key shape and contains no `..` segments. */
export function isPermanentAvatarImageKey(key: string) {
	return permanentAvatarKeyPattern.test(key) && !key.includes("..");
}

/** Whether `key` is a `tmp/` prefixed key whose remainder is a valid permanent avatar key. */
export function isTemporaryAvatarImageKey(key: string) {
	return key.startsWith(TEMPORARY_IMAGE_PREFIX) && isPermanentAvatarImageKey(key.slice(TEMPORARY_IMAGE_PREFIX.length));
}

/** Log note images live per account, since one image can be referenced by several of that account's logs. */
export function noteImagePrefix(userId: string) {
	return `users/${userId}/notes/`;
}

/** Permanent storage key for a log note image, built from the upload id and the content type's extension. */
export function permanentNoteImageKey(userId: string, uploadId: string, contentType: StoredImageContentType) {
	return `${noteImagePrefix(userId)}${uploadId}.${extensionForStoredImage(contentType)}`;
}

/** Temporary (`tmp/`-prefixed) storage key for a log note image that has not been saved yet. */
export function temporaryNoteImageKey(userId: string, uploadId: string, contentType: StoredImageContentType) {
	return `${TEMPORARY_IMAGE_PREFIX}${permanentNoteImageKey(userId, uploadId, contentType)}`;
}

/** Whether `key` matches the permanent note image key shape and contains no `..` segments. */
export function isPermanentNoteImageKey(key: string) {
	return permanentNoteKeyPattern.test(key) && !key.includes("..");
}

/** Whether `key` is a `tmp/` prefixed key whose remainder is a valid permanent note image key. */
export function isTemporaryNoteImageKey(key: string) {
	return key.startsWith(TEMPORARY_IMAGE_PREFIX) && isPermanentNoteImageKey(key.slice(TEMPORARY_IMAGE_PREFIX.length));
}

/**
 * Whether `key` is a permanent note image under the given user's notes prefix.
 * Rejects `..` and requires the filename to be a UUIDv7 with a `.webp` or `.jpg` extension.
 */
export function isOwnedNoteImageKey(userId: string, key: string) {
	const prefix = noteImagePrefix(userId);
	if (!key.startsWith(prefix) || key.includes("..")) return false;
	return uploadFilePattern.test(key.slice(prefix.length));
}

/** Whether `key` is a `tmp/` note image key that belongs to the given user. */
export function isOwnedTemporaryNoteImageKey(userId: string, key: string) {
	if (!isTemporaryNoteImageKey(key)) return false;
	return isOwnedNoteImageKey(userId, key.slice(TEMPORARY_IMAGE_PREFIX.length));
}

/**
 * Upload id embedded in an image key's filename.
 * Strips the directory path and the `.webp`/`.jpg` extension. Does not validate the key.
 */
export function uploadIdFromImageKey(key: string) {
	const filename = key.split("/").pop() ?? "";
	return filename.replace(/\.(webp|jpg)$/iu, "");
}

/** Permanent portrait, avatar, or note image key issued by this app. */
export function isPermanentImageKey(key: string) {
	return isPermanentCharacterImageKey(key) || isPermanentAvatarImageKey(key) || isPermanentNoteImageKey(key);
}

/** `tmp/` portrait, avatar, or note image key. The bucket lifecycle rule deletes this prefix. */
export function isTemporaryImageKey(key: string) {
	return key.startsWith(TEMPORARY_IMAGE_PREFIX) && isPermanentImageKey(key.slice(TEMPORARY_IMAGE_PREFIX.length));
}

/** Permanent key for a staged character portrait, or `null` if `key` is not a temporary character portrait key. */
export function permanentKeyForTemporary(key: string) {
	if (!isTemporaryCharacterImageKey(key)) return null;
	return key.slice(TEMPORARY_IMAGE_PREFIX.length);
}

/** Permanent key for a staged portrait, avatar, or note image, or `null` if `key` is not a temporary image key. */
export function permanentImageKeyForTemporary(key: string) {
	if (!isTemporaryImageKey(key)) return null;
	return key.slice(TEMPORARY_IMAGE_PREFIX.length);
}

/** Whether `key` is a permanent portrait under the given user's and character's prefix. */
export function isOwnedCharacterImageKey(userId: string, characterId: string, key: string) {
	const prefix = characterImagePrefix(userId, characterId);
	if (!key.startsWith(prefix) || key.includes("..")) return false;
	return uploadFilePattern.test(key.slice(prefix.length));
}

/** Whether `key` is a `tmp/` portrait key that stages a permanent portrait owned by the given user and character. */
export function isOwnedTemporaryImageKey(userId: string, characterId: string, key: string) {
	const permanent = permanentKeyForTemporary(key);
	return permanent !== null && isOwnedCharacterImageKey(userId, characterId, permanent);
}

/** Whether `key` is a permanent avatar under the given user's avatar prefix. */
export function isOwnedAvatarImageKey(userId: string, key: string) {
	const prefix = avatarImagePrefix(userId);
	if (!key.startsWith(prefix) || key.includes("..")) return false;
	return uploadFilePattern.test(key.slice(prefix.length));
}

/** Whether `key` is a `tmp/` avatar key that stages a permanent avatar owned by the given user. */
export function isOwnedTemporaryAvatarImageKey(userId: string, key: string) {
	if (!isTemporaryAvatarImageKey(key)) return false;
	return isOwnedAvatarImageKey(userId, key.slice(TEMPORARY_IMAGE_PREFIX.length));
}

/**
 * User id embedded in a permanent portrait, avatar, or note image key, or `null` if the key does not match the server's shape.
 * Relies on the `users/{userId}/...` layout, so the user id is the second path segment.
 */
export function userIdFromPermanentKey(key: string) {
	if (!isPermanentImageKey(key)) return null;
	return key.split("/")[1] ?? null;
}

/**
 * Builds the public URL for a storage key.
 * Joins `publicBase`'s origin and path with the key, encoding each path segment but keeping the `/` separators.
 */
export function imagePublicUrl(key: string, publicBase: string) {
	const base = new URL(publicBase);
	const prefix = base.pathname.replace(/\/$/, "");
	const encoded = key
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");
	return `${base.origin}${prefix}/${encoded}`;
}

/**
 * Reverses `imagePublicUrl`: extracts the storage key from a public image URL.
 * Returns `null` if either URL is invalid, the origin differs from `publicBase`, the path is outside the base path,
 * the path fails to decode, or the result contains `..`, `\`, `//`, or is empty.
 */
export function keyFromPublicUrl(imageUrl: string, publicBase: string) {
	let url: URL;
	let base: URL;
	try {
		url = new URL(imageUrl);
		base = new URL(publicBase);
	} catch {
		return null;
	}

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
	if (!key || key.includes("..") || key.includes("\\") || key.includes("//")) return null;
	return key;
}

/** Storage key for a character portrait URL, or `null` unless the URL points to a permanent portrait owned by this user and character. */
export function ownedPermanentKey(userId: string, characterId: string, imageUrl: string, publicBase: string) {
	const key = keyFromPublicUrl(imageUrl, publicBase);
	if (!key || !isPermanentCharacterImageKey(key) || !isOwnedCharacterImageKey(userId, characterId, key)) return null;
	return key;
}

/** Storage key for an avatar URL, or `null` unless the URL points to a permanent avatar owned by this user. */
export function ownedAvatarKey(userId: string, imageUrl: string, publicBase: string) {
	const key = keyFromPublicUrl(imageUrl, publicBase);
	if (!key || !isPermanentAvatarImageKey(key) || !isOwnedAvatarImageKey(userId, key)) return null;
	return key;
}
