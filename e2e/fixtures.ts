import { test as base, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { userIdForSessionCookies } from "./cleanup-users.ts";
import { assertLocalE2E } from "./env.ts";
import { rememberUser } from "./state.ts";
import { acceptDialogs, installPasskeyAuthenticator, settleNavigations } from "./ui.ts";

export interface Session {
	context: BrowserContext;
	page: Page;
	dialogs: ReturnType<typeof acceptDialogs>;
}

export interface TestUser extends Session {
	id: string;
	handle: string;
	email: string;
}

export interface SignUpOptions {
	/** Added to the username, so failures name the user. Lowercase letters only. */
	label?: string;
	/** Leave the account on `/onboarding`. */
	onboard?: boolean;
}

let sequence = 0;

/** Unique within a run, and safe in usernames, emails, and record names. */
export function uniqueStamp() {
	sequence += 1;
	return `${Date.now().toString(36)}${sequence.toString(36)}`;
}

/** A browser context with no account, like a logged-out visitor. */
export async function openSession(browser: Browser): Promise<Session> {
	assertLocalE2E(process.env);
	const context = await browser.newContext();
	const page = await context.newPage();
	settleNavigations(page);
	const dialogs = acceptDialogs(page);
	return { context, page, dialogs };
}

/** Signs up a new account with its own context and virtual passkey. */
export async function signUpUser(browser: Browser, options: SignUpOptions = {}): Promise<TestUser> {
	const session = await openSession(browser);
	const { context, page } = session;
	await installPasskeyAuthenticator(context);

	await page.goto("/");
	const create = page.getByRole("button", { name: "Create an account with a passkey" });
	await expect(create, "Passkey sign-up is hidden. Leave DISABLE_SIGNUPS unset for the local app.").toBeVisible();
	await create.click();
	await page.waitForURL(/\/onboarding$/);

	const id = (await userIdForSessionCookies(await context.cookies())) ?? "";
	expect(id, "The new session did not resolve to a user id").not.toBe("");
	rememberUser(id);

	const handle = ["e2e", options.label, uniqueStamp()].filter(Boolean).join("-");
	const email = `${handle}@example.com`;
	if (options.onboard !== false) await finishOnboarding(page, handle, email);
	return { ...session, id, handle, email };
}

export async function finishOnboarding(page: Page, handle: string, email: string) {
	await page.getByLabel("Username").fill(handle);
	await page.getByLabel("Email").fill(email);
	await page.getByRole("button", { name: "Continue" }).click();
	await page.waitForURL(/\/characters$/);
}

interface Users {
	signUp(options?: SignUpOptions): Promise<TestUser>;
	visitor(): Promise<Session>;
}

/** `users` contexts close when the test ends. Accounts are removed by the global teardown. */
export const test = base.extend<{ users: Users }>({
	users: async ({ browser }, use) => {
		const sessions: Session[] = [];
		await use({
			async signUp(options) {
				const user = await signUpUser(browser, options);
				sessions.push(user);
				return user;
			},
			async visitor() {
				const session = await openSession(browser);
				sessions.push(session);
				return session;
			}
		});
		for (const session of sessions) await session.context.close();
	}
});

export { expect };
