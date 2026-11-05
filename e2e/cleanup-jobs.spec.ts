import {
	appLogIds,
	cronJob,
	deleteAppLogs,
	deleteExpiredAppLogs,
	deleteExpiredSessions,
	deleteUser,
	insertAppLogs,
	insertBareUser,
	insertSessions,
	sessionIds
} from "./db.ts";
import { expect, test, uniqueStamp } from "./fixtures.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

test("cleanup jobs: each runs once a day at its own time", async () => {
	const jobs = {
		"delete-expired-log-drafts": "0 4 * * *",
		"delete-expired-applogs": "30 4 * * *",
		"delete-expired-sessions": "0 5 * * *"
	};
	for (const [name, schedule] of Object.entries(jobs)) {
		expect(await cronJob(name), name).toEqual([
			{ schedule, command: `select public.${name.replaceAll("-", "_")}()`, active: true }
		]);
	}
	expect(new Set(Object.values(jobs)).size).toBe(Object.keys(jobs).length);
});

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

test("sessions: a daily database job deletes sessions more than 30 days past expiry and keeps the rest", async () => {
	const userId = await insertBareUser(`e2e-sessions-${uniqueStamp()}`);

	try {
		await test.step("adding a session no longer deletes old ones", async () => {
			const [old] = await insertSessions(userId, [-31 * DAY_MS]);
			await insertSessions(userId, [7 * DAY_MS]);
			expect(await sessionIds(userId)).toContain(old);
		});

		await test.step("the job function deletes sessions more than 30 days past expiry", async () => {
			const [oldest, justExpired, almostExpired, expiredYesterday, active] = await insertSessions(userId, [
				-60 * DAY_MS,
				-30 * DAY_MS - MINUTE_MS,
				-30 * DAY_MS + 10 * MINUTE_MS,
				-DAY_MS,
				7 * DAY_MS
			]);

			expect(await deleteExpiredSessions()).toBeGreaterThanOrEqual(3);
			const kept = await sessionIds(userId);
			expect(kept).not.toContain(oldest);
			expect(kept).not.toContain(justExpired);
			expect(kept).toEqual(expect.arrayContaining([almostExpired, expiredYesterday, active]));
			// The 31-day-old session from the first step goes too; the one expiring next week stays.
			expect(kept).toHaveLength(4);
		});
	} finally {
		await deleteUser(userId);
	}
});
