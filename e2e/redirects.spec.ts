import type { Page } from "@playwright/test";
import { expect, finishOnboarding, test } from "./fixtures.ts";
import { settleNavigations } from "./ui.ts";

async function expectSignInFor(page: Page, path: string) {
	await expect.poll(() => new URL(page.url()).pathname).toBe("/");
	expect(new URL(page.url()).searchParams.get("redirect")).toBe(path);
	await expect(page.getByRole("button", { name: "Sign in with Passkey" })).toBeVisible();
}

test("logged-out visitors are sent to sign in", async ({ users }) => {
	const { page } = await users.visitor();
	for (const path of ["/characters", "/dm-logs", "/dms", "/onboarding"]) {
		await test.step(path, async () => {
			await page.goto(path);
			await expectSignInFor(page, path);
		});
	}
});

test("signing in returns to the page that asked for it", async ({ users }) => {
	const user = await users.signUp({ label: "return" });
	const { context } = user;
	await context.clearCookies();
	// The signed-in page reacts to losing its session. Its navigation would abort ours.
	await user.page.close();
	const page = await context.newPage();
	settleNavigations(page);
	await page.goto("/dm-logs");
	await expectSignInFor(page, "/dm-logs");

	// A remembered passkey can sign in on its own. Otherwise use the button.
	const signedIn = await page
		.waitForURL(/\/dm-logs$/, { timeout: 5_000 })
		.then(() => true)
		.catch(() => false);
	if (!signedIn) {
		await page.getByRole("button", { name: "Sign in with Passkey" }).click();
		await page.waitForURL(/\/dm-logs$/);
	}
	await expect(page.getByRole("link", { name: "New Log" }).filter({ visible: true })).toBeVisible();
});

test("unfinished accounts land on onboarding, and finished accounts skip it", async ({ users }) => {
	const { page, handle, email } = await users.signUp({ label: "onboard", onboard: false });

	await test.step("every app page sends an unfinished account to onboarding", async () => {
		for (const path of ["/characters", "/dm-logs", "/dms", "/"]) {
			await page.goto(path);
			await expect(page, path).toHaveURL(/\/onboarding$/);
		}
		await expect(page.getByLabel("Username")).toBeVisible();
	});

	await test.step("a finished account is sent from onboarding to characters", async () => {
		await finishOnboarding(page, handle, email);
		for (const path of ["/onboarding", "/"]) {
			await page.goto(path);
			await expect(page, path).toHaveURL(/\/characters$/);
		}
	});
});
