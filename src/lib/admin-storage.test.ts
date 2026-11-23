import {
	imagePublicUrl,
	permanentAvatarImageKey,
	permanentCharacterImageKey,
	permanentNoteImageKey,
	temporaryAvatarImageKey,
	temporaryCharacterImageKey,
	temporaryNoteImageKey
} from "#lib/images/object-key.js";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
	chunkKeys,
	collectReferencedPermanentKeys,
	computeOrphanedObjects,
	deleteOrphanedObjectsSchema,
	formatAge,
	formatExactBytes,
	matchesOrphanSweepConfirmation,
	ORPHAN_DELETE_BATCH_SIZE,
	orphanSweepConfirmationPhrase,
	pendingDeletionKeySchema,
	type BucketObject
} from "./admin-storage";

const PUBLIC_BASE = "https://images.example.com";
const USER_A = "018f3c1e-7a2b-7c3d-8e4f-0123456789aa";
const USER_B = "018f3c1e-7a2b-7c3d-8e4f-0123456789bb";
const CHAR_A = "018f3c1e-7a2b-7c3d-8e4f-0123456789cc";

const UPLOAD_1 = "019a0000-0000-7000-8000-000000000001";
const UPLOAD_2 = "019a0000-0000-7000-8000-000000000002";
const UPLOAD_3 = "019a0000-0000-7000-8000-000000000003";
const UPLOAD_4 = "019a0000-0000-7000-8000-000000000004";
const UPLOAD_5 = "019a0000-0000-7000-8000-000000000005";
const UPLOAD_6 = "019a0000-0000-7000-8000-000000000006";

const portraitKey = permanentCharacterImageKey(USER_A, CHAR_A, UPLOAD_1, "image/webp");
const avatarKey = permanentAvatarImageKey(USER_A, UPLOAD_2, "image/jpeg");
const noteKey = permanentNoteImageKey(USER_B, UPLOAD_3, "image/webp");
const pendingKey = permanentCharacterImageKey(USER_B, CHAR_A, UPLOAD_4, "image/webp");
const orphanPortraitKey = permanentCharacterImageKey(USER_A, CHAR_A, UPLOAD_5, "image/webp");
const orphanNoteKey = permanentNoteImageKey(USER_A, UPLOAD_6, "image/jpeg");

const tmpPortraitKey = temporaryCharacterImageKey(USER_A, CHAR_A, UPLOAD_5, "image/webp");
const tmpAvatarKey = temporaryAvatarImageKey(USER_A, UPLOAD_2, "image/webp");
const tmpNoteKey = temporaryNoteImageKey(USER_B, UPLOAD_3, "image/jpeg");

const obj = (key: string, bytes: number, lastModified: Date | null = null): BucketObject => ({
	key,
	bytes,
	lastModified
});

describe("collectReferencedPermanentKeys", () => {
	it("collects permanent keys from all four sources and ignores external, blank, or tmp values", () => {
		const referenced = collectReferencedPermanentKeys(
			{
				characterImageUrls: [
					imagePublicUrl(portraitKey, PUBLIC_BASE),
					"https://other-host.example.com/" + orphanPortraitKey,
					"/images/blank-character.jpg",
					"",
					imagePublicUrl(tmpPortraitKey, PUBLIC_BASE)
				],
				userImages: [
					imagePublicUrl(avatarKey, PUBLIC_BASE),
					null,
					undefined,
					"",
					"https://lh3.googleusercontent.com/avatar.png",
					imagePublicUrl(tmpAvatarKey, PUBLIC_BASE)
				],
				imageUploadKeys: [noteKey, tmpNoteKey, "not-a-valid-key.webp"],
				pendingDeletionKeys: [pendingKey, tmpPortraitKey, "misc/file.txt"]
			},
			PUBLIC_BASE
		);

		expect([...referenced].sort()).toEqual([avatarKey, portraitKey, pendingKey, noteKey].sort());
	});

	it("handles public base URLs with a path prefix", () => {
		const prefixedBase = "https://cdn.example.com/uploads/";
		const referenced = collectReferencedPermanentKeys(
			{
				characterImageUrls: [imagePublicUrl(portraitKey, prefixedBase)],
				userImages: [imagePublicUrl(avatarKey, prefixedBase)],
				imageUploadKeys: [],
				pendingDeletionKeys: []
			},
			prefixedBase
		);

		expect(referenced.has(portraitKey)).toBe(true);
		expect(referenced.has(avatarKey)).toBe(true);
	});
});

describe("computeOrphanedObjects", () => {
	it("returns only unreferenced permanent keys, skipping tmp/ and non-permanent keys", () => {
		const referenced = collectReferencedPermanentKeys(
			{
				characterImageUrls: [imagePublicUrl(portraitKey, PUBLIC_BASE)],
				userImages: [imagePublicUrl(avatarKey, PUBLIC_BASE)],
				imageUploadKeys: [noteKey],
				pendingDeletionKeys: [pendingKey]
			},
			PUBLIC_BASE
		);

		const modifiedA = new Date("2026-10-01T00:00:00Z");
		const modifiedB = new Date("2026-10-02T00:00:00Z");

		const summary = computeOrphanedObjects(
			[
				obj(portraitKey, 1000),
				obj(avatarKey, 2000),
				obj(noteKey, 3000),
				obj(pendingKey, 4000),
				obj(orphanNoteKey, 5500, modifiedB),
				obj(orphanPortraitKey, 12500, modifiedA),
				obj(tmpPortraitKey, 9999),
				obj(tmpAvatarKey, 8888),
				obj(tmpNoteKey, 7777),
				obj("tmp/random-file.bin", 6666),
				obj("backups/manual.sql", 5555),
				obj("users/not-a-valid-key.txt", 4444)
			],
			referenced
		);

		expect(summary.scannedPermanentCount).toBe(6);
		expect(summary.skippedTmpCount).toBe(4);
		expect(summary.skippedOtherCount).toBe(2);
		expect(summary.totalBytes).toBe(18000);
		expect(summary.orphans).toEqual([
			{ key: orphanPortraitKey, bytes: 12500, lastModified: modifiedA },
			{ key: orphanNoteKey, bytes: 5500, lastModified: modifiedB }
		]);
	});

	it("deduplicates repeated keys and clamps negative or non-finite byte counts to 0", () => {
		const summary = computeOrphanedObjects(
			[obj(orphanPortraitKey, 4096), obj(orphanPortraitKey, 9999), obj(orphanNoteKey, -50), obj(pendingKey, Number.NaN)],
			new Set()
		);

		expect(summary.scannedPermanentCount).toBe(3);
		expect(summary.orphans.map((o) => ({ key: o.key, bytes: o.bytes }))).toEqual([
			{ key: orphanPortraitKey, bytes: 4096 },
			{ key: orphanNoteKey, bytes: 0 },
			{ key: pendingKey, bytes: 0 }
		]);
		expect(summary.totalBytes).toBe(4096);
	});
});

describe("chunkKeys", () => {
	it("batches keys in groups of at most 1000 by default", () => {
		const keys = Array.from({ length: 2503 }, (_, i) => `k-${i}`);
		const batches = chunkKeys(keys);
		expect(batches.map((batch) => batch.length)).toEqual([1000, 1000, 503]);
		expect(Math.max(...batches.map((batch) => batch.length))).toBeLessThanOrEqual(ORPHAN_DELETE_BATCH_SIZE);
		expect(batches.flat()).toEqual(keys);

		expect(chunkKeys(Array.from({ length: 1000 }, (_, i) => i)).map((batch) => batch.length)).toEqual([1000]);
		expect(chunkKeys(Array.from({ length: 1001 }, (_, i) => i)).map((batch) => batch.length)).toEqual([1000, 1]);
	});

	it("handles empty input and custom sizes, and rejects non-positive sizes", () => {
		expect(chunkKeys([], 10)).toEqual([]);
		expect(chunkKeys([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
		expect(() => chunkKeys([1], 0)).toThrow(RangeError);
		expect(() => chunkKeys([1], -5)).toThrow(RangeError);
		expect(() => chunkKeys([1], 1.5)).toThrow(RangeError);
	});
});

describe("orphan sweep confirmation", () => {
	it("builds and matches the confirmation phrase case-insensitively with whitespace trimmed", () => {
		expect(orphanSweepConfirmationPhrase("ddal-uploads", 12)).toBe("delete 12 from ddal-uploads");
		expect(matchesOrphanSweepConfirmation("ddal-uploads", 12, "delete 12 from ddal-uploads")).toBe(true);
		expect(matchesOrphanSweepConfirmation("ddal-uploads", 12, "  DELETE 12 FROM DDAL-UPLOADS \n")).toBe(true);
	});

	it("rejects wrong count, wrong bucket, empty bucket, zero count, or empty input", () => {
		expect(matchesOrphanSweepConfirmation("ddal-uploads", 12, "delete 11 from ddal-uploads")).toBe(false);
		expect(matchesOrphanSweepConfirmation("ddal-uploads", 12, "delete 12 from ddal-uploads-dev")).toBe(false);
		expect(matchesOrphanSweepConfirmation("ddal-uploads", 12, "")).toBe(false);
		expect(matchesOrphanSweepConfirmation("", 12, "delete 12 from ")).toBe(false);
		expect(matchesOrphanSweepConfirmation("ddal-uploads", 0, "delete 0 from ddal-uploads")).toBe(false);
	});
});

describe("formatting helpers", () => {
	it("formats queue ages across seconds, minutes, hours, and days", () => {
		const now = new Date("2026-11-22T12:00:00Z");
		expect(formatAge(new Date("2026-11-22T12:00:30Z"), now)).toBe("just now");
		expect(formatAge(new Date("2026-11-22T11:59:20Z"), now)).toBe("just now");
		expect(formatAge(new Date("2026-11-22T11:46:00Z"), now)).toBe("14m");
		expect(formatAge(new Date("2026-11-22T09:00:00Z"), now)).toBe("3h");
		expect(formatAge(new Date("2026-11-22T08:48:00Z"), now)).toBe("3h 12m");
		expect(formatAge(new Date("2026-11-20T12:00:00Z"), now)).toBe("2d");
		expect(formatAge(new Date("2026-11-20T07:00:00Z"), now)).toBe("2d 5h");
	});

	it("formats exact byte counts cleanly", () => {
		expect(formatExactBytes(0)).toBe("0 B");
		expect(formatExactBytes(-10)).toBe("0 B");
		expect(formatExactBytes(512)).toBe("512 B");
		expect(formatExactBytes(1536)).toBe("1.5 KB");
		expect(formatExactBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
		expect(formatExactBytes(2 * 1024 * 1024 * 1024)).toBe("2 GB");
	});
});

describe("admin storage input schemas", () => {
	it("validates pending deletion key input", () => {
		expect(v.safeParse(pendingDeletionKeySchema, { objectKey: portraitKey }).success).toBe(true);
		expect(v.safeParse(pendingDeletionKeySchema, { objectKey: "   " }).success).toBe(false);
		expect(v.safeParse(pendingDeletionKeySchema, {}).success).toBe(false);
	});

	it("validates orphan deletion payload", () => {
		expect(
			v.safeParse(deleteOrphanedObjectsSchema, {
				keys: [orphanPortraitKey],
				token: "a".repeat(64),
				issuedAt: Date.now(),
				confirmation: "delete 1 from ddal-uploads"
			}).success
		).toBe(true);

		expect(
			v.safeParse(deleteOrphanedObjectsSchema, {
				keys: [],
				token: "a".repeat(64),
				issuedAt: Date.now(),
				confirmation: "delete 0 from ddal-uploads"
			}).success
		).toBe(false);

		expect(
			v.safeParse(deleteOrphanedObjectsSchema, {
				keys: [orphanPortraitKey],
				token: "",
				issuedAt: 123,
				confirmation: "delete 1 from ddal-uploads"
			}).success
		).toBe(false);
	});
});
