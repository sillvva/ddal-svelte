import { describe, expect, it } from "vitest";
import { chunk, DELETE_BATCH_SIZE, emptyBucket, planClean, type BucketOps, type CleanEnv } from "./r2-clean-dev.ts";

const creds: CleanEnv = {
	R2_BUCKET: "ddal-uploads-dev",
	R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
	R2_ACCESS_KEY_ID: "id",
	R2_SECRET_ACCESS_KEY: "s3cr3t-value"
};

describe("planClean", () => {
	it("cleans the default dev bucket", () => {
		expect(planClean(creds)).toMatchObject({ action: "clean", bucket: "ddal-uploads-dev" });
	});

	it("skips with SKIP_R2_CLEAN, even for a refusable bucket", () => {
		expect(planClean({ ...creds, SKIP_R2_CLEAN: "1" }).action).toBe("skip");
		expect(planClean({ ...creds, R2_BUCKET: "ddal-uploads", SKIP_R2_CLEAN: "1" }).action).toBe("skip");
	});

	it.each(["R2_BUCKET", "R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"])(
		"skips when %s is missing or empty",
		(name) => {
			expect(planClean({ ...creds, [name]: undefined }).action).toBe("skip");
			expect(planClean({ ...creds, [name]: "" }).action).toBe("skip");
		}
	);

	it("skips when nothing is set (CI)", () => {
		expect(planClean({}).action).toBe("skip");
	});

	it("refuses the production bucket", () => {
		expect(planClean({ ...creds, R2_BUCKET: "ddal-uploads" }).action).toBe("refuse");
	});

	it("refuses any other bucket name", () => {
		expect(planClean({ ...creds, R2_BUCKET: "ddal-uploads-dev2" }).action).toBe("refuse");
		expect(planClean({ ...creds, R2_BUCKET: " ddal-uploads-dev" }).action).toBe("refuse");
		expect(planClean({ ...creds, R2_BUCKET: "e2e" }).action).toBe("refuse");
	});

	it("allows another bucket only through R2_DEV_BUCKET", () => {
		expect(planClean({ ...creds, R2_BUCKET: "my-dev", R2_DEV_BUCKET: "my-dev" })).toMatchObject({
			action: "clean",
			bucket: "my-dev"
		});
		expect(planClean({ ...creds, R2_BUCKET: "my-dev", R2_DEV_BUCKET: "other" }).action).toBe("refuse");
	});

	it("never accepts the production bucket through R2_DEV_BUCKET", () => {
		expect(planClean({ ...creds, R2_BUCKET: "ddal-uploads", R2_DEV_BUCKET: "ddal-uploads" }).action).toBe("refuse");
		expect(planClean({ ...creds, R2_DEV_BUCKET: "ddal-uploads" }).action).toBe("refuse");
	});

	it("does not leak secrets in a reason", () => {
		for (const env of [
			{ ...creds, R2_BUCKET: "ddal-uploads" },
			{ ...creds, R2_BUCKET: "nope" },
			{ ...creds, R2_ENDPOINT: "" }
		]) {
			const plan = planClean(env);
			if (plan.action === "clean") throw new Error("expected no clean");
			expect(plan.reason).not.toContain("s3cr3t-value");
		}
	});
});

describe("chunk", () => {
	it("splits into batches of at most the size", () => {
		expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
		expect(chunk([], 2)).toEqual([]);
	});
});

function fakeBucket(pages: string[][]) {
	const removed: string[][] = [];
	const ops: BucketOps = {
		list: (_bucket, token) => {
			const index = token ? Number(token) : 0;
			const keys = pages[index] ?? [];
			return Promise.resolve({ keys, next: index + 1 < pages.length ? String(index + 1) : undefined });
		},
		remove: (_bucket, keys) => {
			removed.push(keys);
			return Promise.resolve({ deleted: keys.length, errors: [] });
		}
	};
	return { ops, removed };
}

describe("emptyBucket", () => {
	it("returns 0 for an empty bucket", async () => {
		const { ops, removed } = fakeBucket([[]]);
		expect(await emptyBucket(ops, "b")).toBe(0);
		expect(removed).toEqual([]);
	});

	it("walks every page and deletes in batches of at most 1000", async () => {
		const page = (start: number, count: number) => Array.from({ length: count }, (_, i) => `k${start + i}`);
		const { ops, removed } = fakeBucket([page(0, 2500), page(2500, 3)]);
		expect(await emptyBucket(ops, "b")).toBe(2503);
		expect(removed.map((batch) => batch.length)).toEqual([1000, 1000, 500, 3]);
		expect(Math.max(...removed.map((batch) => batch.length))).toBeLessThanOrEqual(DELETE_BATCH_SIZE);
	});

	it("fails when a delete reports errors", async () => {
		const ops: BucketOps = {
			list: () => Promise.resolve({ keys: ["a", "b"] }),
			remove: () => Promise.resolve({ deleted: 1, errors: ["AccessDenied: nope"] })
		};
		await expect(emptyBucket(ops, "b")).rejects.toThrow(/AccessDenied/);
	});
});
