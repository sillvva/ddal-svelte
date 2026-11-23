import { isPermanentImageKey, keyFromPublicUrl, TEMPORARY_IMAGE_PREFIX } from "#lib/images/object-key.js";
import * as v from "valibot";

/** S3 / R2 `DeleteObjects` accepts at most 1000 keys per request. */
export const ORPHAN_DELETE_BATCH_SIZE = 1000;

/** How long a dry-run token remains valid before the admin must run a fresh scan. */
export const ORPHAN_DRY_RUN_TTL_MS = 15 * 60 * 1000;

export interface BucketObject {
	key: string;
	bytes: number;
	lastModified: Date | null;
}

export interface OrphanReferenceSources {
	characterImageUrls: readonly string[];
	userImages: readonly (string | null | undefined)[];
	imageUploadKeys: readonly string[];
	pendingDeletionKeys: readonly string[];
}

export interface OrphanSweepSummary {
	orphans: BucketObject[];
	totalBytes: number;
	scannedPermanentCount: number;
	skippedTmpCount: number;
	skippedOtherCount: number;
}

export interface PendingDeletionRow {
	id: string;
	objectKey: string;
	createdAt: Date;
	attempts: number;
}

function compareKeys(a: string, b: string) {
	return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Collects every permanent R2 object key referenced by `character.image_url`, `user.image`,
 * `image_upload.object_key`, or `pending_object_deletion.object_key`.
 */
export function collectReferencedPermanentKeys(sources: OrphanReferenceSources, publicBase: string): Set<string> {
	const referenced = new Set<string>();

	for (const url of sources.characterImageUrls) {
		if (!url) continue;
		const key = keyFromPublicUrl(url, publicBase);
		if (key && isPermanentImageKey(key)) referenced.add(key);
	}

	for (const url of sources.userImages) {
		if (!url) continue;
		const key = keyFromPublicUrl(url, publicBase);
		if (key && isPermanentImageKey(key)) referenced.add(key);
	}

	for (const key of sources.imageUploadKeys) {
		if (isPermanentImageKey(key)) referenced.add(key);
	}

	for (const key of sources.pendingDeletionKeys) {
		if (isPermanentImageKey(key)) referenced.add(key);
	}

	return referenced;
}

/**
 * Computes orphaned permanent R2 objects from a bucket listing and the set of referenced permanent keys.
 * `tmp/` keys (handled by the bucket lifecycle rule) and non-permanent keys are always skipped.
 */
export function computeOrphanedObjects(
	objects: readonly BucketObject[],
	referencedKeys: ReadonlySet<string>
): OrphanSweepSummary {
	const seen = new Set<string>();
	const orphans: BucketObject[] = [];
	let totalBytes = 0;
	let scannedPermanentCount = 0;
	let skippedTmpCount = 0;
	let skippedOtherCount = 0;

	for (const object of objects) {
		const { key } = object;
		if (seen.has(key)) continue;
		seen.add(key);

		if (key.startsWith(TEMPORARY_IMAGE_PREFIX)) {
			skippedTmpCount += 1;
			continue;
		}
		if (!isPermanentImageKey(key)) {
			skippedOtherCount += 1;
			continue;
		}

		scannedPermanentCount += 1;
		if (referencedKeys.has(key)) continue;

		const bytes = Number.isFinite(object.bytes) && object.bytes > 0 ? Math.trunc(object.bytes) : 0;
		orphans.push({
			key,
			bytes,
			lastModified: object.lastModified ?? null
		});
		totalBytes += bytes;
	}

	orphans.sort((a, b) => compareKeys(a.key, b.key));

	return {
		orphans,
		totalBytes,
		scannedPermanentCount,
		skippedTmpCount,
		skippedOtherCount
	};
}

/** Splits a list into chunks of at most `size` items. */
export function chunkKeys<T>(items: readonly T[], size = ORPHAN_DELETE_BATCH_SIZE): T[][] {
	if (!Number.isInteger(size) || size < 1) {
		throw new RangeError("Batch size must be a positive integer");
	}
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
}

/** Phrase an admin must type to confirm deleting the orphaned objects found in a dry run. */
export function orphanSweepConfirmationPhrase(bucket: string, count: number) {
	return `delete ${count} from ${bucket}`;
}

/** Case-insensitive, whitespace-trimmed match against the confirmation phrase for a bucket and count. */
export function matchesOrphanSweepConfirmation(bucket: string, count: number, confirmation: string) {
	const trimmedBucket = bucket.trim();
	if (!trimmedBucket || !Number.isInteger(count) || count < 1) return false;
	return confirmation.trim().toLowerCase() === orphanSweepConfirmationPhrase(trimmedBucket, count).toLowerCase();
}

/** Concise elapsed duration for queue items (e.g. `just now`, `14m`, `3h 12m`, `2d 5h`). */
export function formatAge(createdAt: Date, now: Date = new Date()): string {
	const elapsedMs = Math.max(0, now.getTime() - createdAt.getTime());
	const totalMinutes = Math.floor(elapsedMs / 60_000);
	if (totalMinutes < 1) return "just now";
	if (totalMinutes < 60) return `${totalMinutes}m`;

	const totalHours = Math.floor(totalMinutes / 60);
	const remMinutes = totalMinutes % 60;
	if (totalHours < 24) return remMinutes > 0 ? `${totalHours}h ${remMinutes}m` : `${totalHours}h`;

	const days = Math.floor(totalHours / 24);
	const remHours = totalHours % 24;
	return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

/** Human-readable byte count for storage audits (e.g. `0 B`, `512 B`, `42.3 KB`, `1.8 MB`, `2.1 GB`). */
export function formatExactBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	if (bytes < 1024) return `${Math.round(bytes)} B`;
	const units = ["KB", "MB", "GB", "TB"] as const;
	let value = bytes / 1024;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	const rounded = Math.round(value * 10) / 10;
	return `${rounded} ${units[unitIndex]}`;
}

export const pendingDeletionKeySchema = v.object({
	objectKey: v.pipe(v.string(), v.trim(), v.minLength(1, "Object key is required"))
});

export const deleteOrphanedObjectsSchema = v.object({
	keys: v.pipe(v.array(v.pipe(v.string(), v.minLength(1))), v.minLength(1, "No orphaned keys to delete")),
	token: v.pipe(v.string(), v.minLength(1, "Dry run token is required")),
	issuedAt: v.pipe(v.number(), v.integer()),
	confirmation: v.string()
});
