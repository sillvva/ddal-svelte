import type { StoredImageContentType } from "#lib/images/limits.js";

const uploadFilePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$/iu;

export function characterImagePrefix(userId: string, characterId: string) {
	return `users/${userId}/characters/${characterId}/`;
}

export function isOwnedCharacterImageKey(userId: string, characterId: string, key: string) {
	const prefix = characterImagePrefix(userId, characterId);
	if (!key.startsWith(prefix)) return false;
	return uploadFilePattern.test(key.slice(prefix.length));
}

export function extensionForStoredImage(contentType: StoredImageContentType) {
	return contentType === "image/webp" ? "webp" : "jpg";
}
