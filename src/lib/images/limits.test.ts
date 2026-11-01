import { describe, expect, it } from "vitest";
import { IMAGE_STORAGE_LIMITS, imageStorageView } from "./limits";

const MB = 1024 * 1024;
const quotaBytes = IMAGE_STORAGE_LIMITS.quotaBytes;

describe("imageStorageView", () => {
	it("adds portrait and note bytes against one shared quota", () => {
		const view = imageStorageView({ portraitBytes: 5 * MB, noteBytes: 10 * MB, quotaBytes });
		expect(view.usedBytes).toBe(15 * MB);
		expect(view.quotaBytes).toBe(50 * MB);
		expect(view.usedLabel).toBe("15 MB");
		expect(view.quotaLabel).toBe("50 MB");
		expect(view.percent).toBe(30);
		expect(view.tone).toBe("primary");
		expect(view.portraitsLabel).toBe("5 MB");
		expect(view.notesLabel).toBe("10 MB");
	});

	it("shows empty storage as 0 MB", () => {
		const view = imageStorageView({ portraitBytes: 0, noteBytes: 0, quotaBytes });
		expect(view.usedLabel).toBe("0 MB");
		expect(view.portraitsLabel).toBe("0 MB");
		expect(view.notesLabel).toBe("0 MB");
		expect(view.percent).toBe(0);
	});

	it("warns near the limit whichever type fills it", () => {
		expect(imageStorageView({ portraitBytes: 41 * MB, noteBytes: 0, quotaBytes }).tone).toBe("warning");
		expect(imageStorageView({ portraitBytes: 0, noteBytes: 41 * MB, quotaBytes }).tone).toBe("warning");
		expect(imageStorageView({ portraitBytes: 25 * MB, noteBytes: 25 * MB, quotaBytes }).tone).toBe("error");
	});

	it("caps the percentage at 100", () => {
		const view = imageStorageView({ portraitBytes: 40 * MB, noteBytes: 40 * MB, quotaBytes });
		expect(view.percent).toBe(100);
		expect(view.tone).toBe("error");
	});
});
