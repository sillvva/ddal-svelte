import { describe, expect, it } from "vitest";
import { CHARACTER_IMAGE_LIMITS, imageStorageView, NOTE_IMAGE_LIMITS } from "./limits";

const MB = 1024 * 1024;
const portraitQuota = CHARACTER_IMAGE_LIMITS.quotaBytes;
const noteQuota = NOTE_IMAGE_LIMITS.quotaBytes;

describe("imageStorageView", () => {
	it("combines portrait and note bytes against both quotas", () => {
		const view = imageStorageView({ usedBytes: 5 * MB, quotaBytes: portraitQuota }, { usedBytes: 9 * MB, quotaBytes: noteQuota });
		expect(view.usedBytes).toBe(14 * MB);
		expect(view.quotaBytes).toBe(70 * MB);
		expect(view.usedLabel).toBe("14 MB");
		expect(view.quotaLabel).toBe("70 MB");
		expect(view.percent).toBe(20);
		expect(view.tone).toBe("primary");
		expect(view.portraits).toMatchObject({ usedLabel: "5 MB", quotaLabel: "20 MB", percent: 25, tone: "primary" });
		expect(view.notes).toMatchObject({ usedLabel: "9 MB", quotaLabel: "50 MB", percent: 18, tone: "primary" });
	});

	it("shows empty storage as 0 MB", () => {
		const view = imageStorageView({ usedBytes: 0, quotaBytes: portraitQuota }, { usedBytes: 0, quotaBytes: noteQuota });
		expect(view.usedLabel).toBe("0 MB");
		expect(view.percent).toBe(0);
	});

	it("takes its tone from the fullest category", () => {
		const full = imageStorageView(
			{ usedBytes: portraitQuota, quotaBytes: portraitQuota },
			{ usedBytes: 0, quotaBytes: noteQuota }
		);
		expect(full.percent).toBe(29);
		expect(full.tone).toBe("error");
		expect(full.portraits.tone).toBe("error");

		const nearlyFull = imageStorageView(
			{ usedBytes: 0, quotaBytes: portraitQuota },
			{ usedBytes: 41 * MB, quotaBytes: noteQuota }
		);
		expect(nearlyFull.tone).toBe("warning");
		expect(nearlyFull.notes.tone).toBe("warning");
	});

	it("caps percentages at 100", () => {
		const view = imageStorageView(
			{ usedBytes: 2 * portraitQuota, quotaBytes: portraitQuota },
			{ usedBytes: 2 * noteQuota, quotaBytes: noteQuota }
		);
		expect(view.percent).toBe(100);
		expect(view.portraits.percent).toBe(100);
	});
});
