import type { StoredImageContentType } from "#lib/images/limits.js";

const uploadFilePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$/iu;

/**
 * Unsaved browser uploads live under this prefix.
 * An R2 lifecycle rule (configured on the bucket, not by the app) deletes them after about a day.
 */
export const TEMPORARY_IMAGE_PREFIX = "tmp/";

const permanentKeyPattern =
	/^users\/[0-9a-f-]{36}\/characters\/[0-9a-f-]{36}\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$/iu;

export function characterImagePrefix(userId: string, characterId: string) {
	return `users/${userId}/characters/${characterId}/`;
}

export function extensionForStoredImage(contentType: StoredImageContentType) {
	return contentType === "image/webp" ? "webp" : "jpg";
}

export function permanentCharacterImageKey(
	userId: string,
	characterId: string,
	uploadId: string,
	contentType: StoredImageContentType
) {
	return `${characterImagePrefix(userId, characterId)}${uploadId}.${extensionForStoredImage(contentType)}`;
}

export function temporaryCharacterImageKey(
	userId: string,
	characterId: string,
	uploadId: string,
	contentType: StoredImageContentType
) {
	return `${TEMPORARY_IMAGE_PREFIX}${permanentCharacterImageKey(userId, characterId, uploadId, contentType)}`;
}

export function isPermanentCharacterImageKey(key: string) {
	return permanentKeyPattern.test(key) && !key.includes("..");
}

export function isTemporaryCharacterImageKey(key: string) {
	return key.startsWith(TEMPORARY_IMAGE_PREFIX) && isPermanentCharacterImageKey(key.slice(TEMPORARY_IMAGE_PREFIX.length));
}

export function permanentKeyForTemporary(key: string) {
	if (!isTemporaryCharacterImageKey(key)) return null;
	return key.slice(TEMPORARY_IMAGE_PREFIX.length);
}

export function isOwnedCharacterImageKey(userId: string, characterId: string, key: string) {
	const prefix = characterImagePrefix(userId, characterId);
	if (!key.startsWith(prefix) || key.includes("..")) return false;
	return uploadFilePattern.test(key.slice(prefix.length));
}

export function isOwnedTemporaryImageKey(userId: string, characterId: string, key: string) {
	const permanent = permanentKeyForTemporary(key);
	return permanent !== null && isOwnedCharacterImageKey(userId, characterId, permanent);
}

/** User id embedded in a permanent portrait key, when the key matches the server's shape. */
export function userIdFromPermanentKey(key: string) {
	if (!isPermanentCharacterImageKey(key)) return null;
	return key.split("/")[1] ?? null;
}

export function imagePublicUrl(key: string, publicBase: string) {
	const base = new URL(publicBase);
	const prefix = base.pathname.replace(/\/$/, "");
	const encoded = key
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");
	return `${base.origin}${prefix}/${encoded}`;
}

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

export function ownedPermanentKey(userId: string, characterId: string, imageUrl: string, publicBase: string) {
	const key = keyFromPublicUrl(imageUrl, publicBase);
	if (!key || !isPermanentCharacterImageKey(key) || !isOwnedCharacterImageKey(userId, characterId, key)) return null;
	return key;
}
