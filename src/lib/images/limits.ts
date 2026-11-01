/**
 * One storage budget per account, shared by saved character portraits and saved note images.
 * Admin accounts are exempt. Unsaved `tmp/` uploads and avatars do not count.
 */
export const IMAGE_STORAGE_LIMITS = {
	quotaBytes: 50 * 1024 * 1024
} as const;

/** Limits for character portraits stored in R2. */
export const CHARACTER_IMAGE_LIMITS = {
	/** Largest file the browser will read before resizing. */
	maxOriginalBytes: 2 * 1024 * 1024,
	/** Largest object accepted into the bucket. Enforced again when the upload is confirmed. */
	maxStoredBytes: Math.floor(0.5 * 1024 * 1024),
	/** Longest edge after the browser resize. The portrait keeps its aspect ratio. */
	maxEdgePx: 800,
	/** Reject decoded images above this pixel count before drawing them. */
	maxPixels: 24_000_000,
	/** Issued upload rows per account, portraits and avatars together. */
	maxUploadsPerWindow: 20,
	rateWindowMs: 60 * 60 * 1000,
	/** Presigned PUT lifetime. The URL can only write under `tmp/`. */
	signedUrlSeconds: 120,
	acceptedInputTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] as const
} as const;

/**
 * Profile pictures for accounts that do not sign in with OAuth.
 * The browser center-crops to a square and scales the long edge down to `maxEdgePx`.
 * One avatar per account, so these bytes are not part of `IMAGE_STORAGE_LIMITS.quotaBytes`.
 */
export const AVATAR_IMAGE_LIMITS = {
	maxOriginalBytes: CHARACTER_IMAGE_LIMITS.maxOriginalBytes,
	/** 256px WebP or JPEG stays under this after the quality steps in the resizer. */
	maxStoredBytes: 100 * 1024,
	maxEdgePx: 256,
	maxPixels: CHARACTER_IMAGE_LIMITS.maxPixels,
	acceptedInputTypes: CHARACTER_IMAGE_LIMITS.acceptedInputTypes
} as const;

/**
 * Images pasted or dropped into log notes.
 * Bytes count against `IMAGE_STORAGE_LIMITS.quotaBytes` once a log save promotes them out of `tmp/`, and stop counting
 * when no log of the owner references them any more.
 */
export const NOTE_IMAGE_LIMITS = {
	maxOriginalBytes: 8 * 1024 * 1024,
	maxStoredBytes: Math.floor(0.5 * 1024 * 1024),
	maxEdgePx: 1200,
	maxPixels: CHARACTER_IMAGE_LIMITS.maxPixels,
	/** Distinct uploaded images one note may reference. Pending uploads count toward this in the browser. */
	maxImagesPerNote: 10,
	/** Uploads one notes field runs at once. */
	maxConcurrentUploads: 3,
	/** Issued note upload rows per account. Counted separately from portraits and avatars. */
	maxUploadsPerWindow: 60,
	rateWindowMs: CHARACTER_IMAGE_LIMITS.rateWindowMs,
	acceptedInputTypes: CHARACTER_IMAGE_LIMITS.acceptedInputTypes
} as const;

export const STORED_IMAGE_CONTENT_TYPES = ["image/webp", "image/jpeg"] as const;
export type StoredImageContentType = (typeof STORED_IMAGE_CONTENT_TYPES)[number];

export function isStoredImageContentType(value: string): value is StoredImageContentType {
	return (STORED_IMAGE_CONTENT_TYPES as readonly string[]).includes(value);
}

export function formatBytes(bytes: number) {
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	const megabytes = bytes / (1024 * 1024);
	const rounded = Math.round(megabytes * 10) / 10;
	return `${rounded} MB`;
}

export function formatStorageBytes(bytes: number) {
	if (bytes <= 0) return "0 MB";
	return formatBytes(bytes);
}

export function storageTone(ratio: number) {
	if (ratio >= 1) return "error" as const;
	if (ratio >= 0.8) return "warning" as const;
	return "primary" as const;
}

export interface ImageStorageUsage {
	portraitBytes: number;
	noteBytes: number;
	quotaBytes: number;
}

export function imageStorageView({ portraitBytes, noteBytes, quotaBytes }: ImageStorageUsage) {
	const usedBytes = portraitBytes + noteBytes;
	const ratio = quotaBytes > 0 ? usedBytes / quotaBytes : 1;
	return {
		usedBytes,
		quotaBytes,
		percent: Math.min(100, Math.round(ratio * 100)),
		tone: storageTone(ratio),
		usedLabel: formatStorageBytes(usedBytes),
		quotaLabel: formatStorageBytes(quotaBytes),
		portraitsLabel: formatStorageBytes(portraitBytes),
		notesLabel: formatStorageBytes(noteBytes)
	};
}
