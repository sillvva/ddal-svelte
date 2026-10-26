import type { StoredImageContentType } from "#lib/images/limits.js";

const RIFF = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP = [0x57, 0x45, 0x42, 0x50] as const;
const JPEG = [0xff, 0xd8, 0xff] as const;

function matches(bytes: Uint8Array, signature: readonly number[], offset: number) {
	if (bytes.length < offset + signature.length) return false;
	return signature.every((value, index) => bytes[offset + index] === value);
}

/** WebP files start with `RIFF????WEBP`. JPEG files start with `FF D8 FF`. */
export function magicBytesMatch(contentType: StoredImageContentType, bytes: Uint8Array) {
	if (contentType === "image/webp") return matches(bytes, RIFF, 0) && matches(bytes, WEBP, 8);
	return matches(bytes, JPEG, 0);
}
