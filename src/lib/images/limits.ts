/** Limits for character portraits stored in R2. */
export const CHARACTER_IMAGE_LIMITS = {
	/** Largest file the browser will read before resizing. */
	maxOriginalBytes: 2 * 1024 * 1024,
	/** Largest object accepted into the bucket. Enforced again when the upload is confirmed. */
	maxStoredBytes: Math.floor(0.5 * 1024 * 1024),
	/** Longest edge after the browser resize. */
	maxEdgePx: 800,
	/** Reject decoded images above this pixel count before drawing them. */
	maxPixels: 24_000_000,
	/** Total bytes of uploaded portraits per account. */
	quotaBytes: 20 * 1024 * 1024,
	maxUploadsPerWindow: 20,
	rateWindowMs: 60 * 60 * 1000,
	/** Presigned PUT lifetime. */
	signedUrlSeconds: 120,
	/** Unfinished reservations older than this are discarded. Longer than the signed URL so a slow PUT can still be confirmed. */
	pendingTtlMs: 3 * 60 * 1000,
	/** Completed uploads that were never saved on a character are removed after this. */
	unattachedTtlMs: 7 * 24 * 60 * 60 * 1000,
	acceptedInputTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] as const
} as const;

export const STORED_IMAGE_CONTENT_TYPES = ["image/webp", "image/jpeg"] as const;
export type StoredImageContentType = (typeof STORED_IMAGE_CONTENT_TYPES)[number];

export function formatBytes(bytes: number) {
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	const megabytes = bytes / (1024 * 1024);
	const rounded = Math.round(megabytes * 10) / 10;
	return `${rounded} MB`;
}
