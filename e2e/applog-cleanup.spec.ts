import { appLogIds, cronJob, deleteAppLogs, deleteExpiredAppLogs, insertAppLogs } from "./db.ts";
import { expect, test, uniqueStamp } from "./fixtures.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

test("app logs: a daily database job deletes logs at least 14 days old and keeps newer ones", async () => {
	const label = `e2e-applog-${uniqueStamp()}`;

	try {
		await test.step("the job is scheduled once a day", async () => {
			expect(await cronJob("delete-expired-applogs")).toEqual([
				{ schedule: "30 4 * * *", command: "select public.delete_expired_applogs()", active: true }
			]);
		});

		await test.step("inserting a log no longer deletes old ones", async () => {
			const [old] = await insertAppLogs(label, [15 * DAY_MS]);
			await insertAppLogs(label, [0]);
			expect(await appLogIds(label)).toContain(old);
		});

		await test.step("the job function deletes logs 14 days old or older", async () => {
			await deleteAppLogs(label);
			const [, oldest, justExpired, almostExpired, recent] = await insertAppLogs(label, [
				0,
				30 * DAY_MS,
				14 * DAY_MS + MINUTE_MS,
				14 * DAY_MS - 10 * MINUTE_MS,
				DAY_MS
			]);
			const fresh = (await appLogIds(label)).filter((id) => id !== oldest && id !== justExpired);

			expect(await deleteExpiredAppLogs()).toBeGreaterThanOrEqual(2);
			const kept = await appLogIds(label);
			expect(kept).not.toContain(oldest);
			expect(kept).not.toContain(justExpired);
			expect(kept).toEqual(expect.arrayContaining([almostExpired, recent]));
			expect(kept.toSorted()).toEqual(fresh.toSorted());
		});
	} finally {
		await deleteAppLogs(label);
	}
});
