import type { Page } from "@playwright/test";
import {
	appLogIds,
	characterRow,
	deleteAppLogs,
	insertAppLogs,
	insertSessions,
	sessionIds,
	setCharacterImageBytes,
	userStatus
} from "./db.ts";
import { expect, test, uniqueStamp } from "./fixtures.ts";
import { createCharacter, errorToast } from "./records.ts";
import { callCommand, submitTampered } from "./remote.ts";
import { closeSettings, openSettings, waitForHydration } from "./ui.ts";

function userRow(page: Page, handle: string) {
	return page.locator("tbody tr").filter({ hasText: handle });
}

function adminMenuButton(page: Page) {
	return page.getByRole("button", { name: "Admin", exact: true });
}

async function openAdminPage(page: Page, name: "Users" | "Logs") {
	await adminMenuButton(page).click();
	await page.locator("#admin-menu").getByRole("link", { name, exact: true }).click();
}

function toast(page: Page, message: string | RegExp) {
	return page.locator("[data-sonner-toast]").filter({ hasText: message });
}

async function searchUsers(page: Page, query: string) {
	const input = page.getByPlaceholder("Search by name, email, role, etc.");
	await input.fill(`"${query}"`);
}

test("admin access: only admins can open admin pages and call admin endpoints", async ({ users }) => {
	const admin = await users.signUp({ label: "admin", role: "admin" });
	const otherAdmin = await users.signUp({ label: "adminb", role: "admin" });
	const member = await users.signUp({ label: "member" });
	const otherMember = await users.signUp({ label: "memberb" });
	const visitor = await users.visitor();

	await test.step("logged-out visitors are sent to sign in", async () => {
		await visitor.page.goto("/admin/users");
		await expect.poll(() => new URL(visitor.page.url()).pathname).toBe("/");
		expect(new URL(visitor.page.url()).searchParams.get("redirect")).toBe("/admin/users");
		await expect(visitor.page.getByRole("button", { name: "Sign in with Passkey" })).toBeVisible();

		await visitor.page.goto("/admin/logs");
		await expect.poll(() => new URL(visitor.page.url()).pathname).toBe("/");
		await expect(visitor.page.getByRole("button", { name: "Sign in with Passkey" })).toBeVisible();
	});

	await test.step("regular users do not see admin navigation and are redirected from admin pages", async () => {
		await expect(adminMenuButton(member.page)).toHaveCount(0);
		for (const path of ["/admin/users", "/admin/logs"]) {
			await member.page.goto(path);
			await expect(member.page).toHaveURL(/\/characters$/);
		}
	});

	await test.step("regular users cannot call admin commands", async () => {
		const label = `e2e-admin-guard-${uniqueStamp()}`;
		const [logId] = await insertAppLogs(label, [0]);
		try {
			const result = await callCommand(member.page, "src/lib/remote/admin/actions.remote.ts", "deleteAppLog", logId);
			expect(result.ok).toBe(false);
			expect(await appLogIds(label)).toEqual([logId]);
		} finally {
			await deleteAppLogs(label);
		}
	});

	await test.step("admins can navigate admin pages and search non-admin users", async () => {
		const { page } = admin;
		await expect(adminMenuButton(page)).toBeVisible();
		await openAdminPage(page, "Users");
		await page.waitForURL(/\/admin\/users$/);

		await expect(userRow(page, member.handle)).toBeVisible();
		await expect(userRow(page, otherMember.handle)).toBeVisible();
		await expect(userRow(page, admin.handle)).toHaveCount(0);
		await expect(userRow(page, otherAdmin.handle)).toHaveCount(0);

		await searchUsers(page, member.handle);
		await expect(userRow(page, member.handle)).toBeVisible();
		await expect(userRow(page, otherMember.handle)).toHaveCount(0);
		await expect(page.getByText(/^Showing 1 of \d+ users$/)).toBeVisible();

		await openAdminPage(page, "Logs");
		await page.waitForURL(/\/admin\/logs$/);
		await openAdminPage(page, "Users");
		await page.waitForURL(/\/admin\/users$/);
	});
});

test("admin impersonation: impersonating a user switches sessions and stopping restores admin", async ({ users }) => {
	const admin = await users.signUp({ label: "impadmin", role: "admin" });
	const otherAdmin = await users.signUp({ label: "impadminb", role: "admin" });
	const target = await users.signUp({ label: "imptarget" });

	const adminCharacterName = `E2E Admin Hero ${admin.handle}`;
	const targetCharacterName = `E2E Target Hero ${target.handle}`;
	await createCharacter(admin.page, { name: adminCharacterName });
	const targetCharacterId = await createCharacter(target.page, { name: targetCharacterName });

	const { page } = admin;

	await test.step("impersonate a regular user from the admin users list", async () => {
		await page.goto("/admin/users");
		await searchUsers(page, target.handle);
		const row = userRow(page, target.handle);
		await expect(row).toBeVisible();
		await expect(row).toContainText(target.email);

		await row.getByRole("button", { name: `Impersonate ${target.handle}`, exact: true }).click();
		await page.waitForURL(/\/characters$/);

		// Session locals and character queries refresh immediately without a manual reload.
		await expect(page.getByRole("link", { name: targetCharacterName }).filter({ visible: true })).toBeVisible();
		await expect(page.getByRole("link", { name: adminCharacterName })).toHaveCount(0);
		await expect(page.getByRole("button", { name: target.handle, exact: true })).toBeVisible();
		await expect(adminMenuButton(page)).toHaveCount(0);
	});

	await test.step("while impersonating, admin routes are blocked and target records are editable", async () => {
		await page.goto("/admin/users");
		await expect(page).toHaveURL(/\/characters$/);

		const response = await page.reload({ waitUntil: "load" });
		expect(response?.ok()).toBe(true);
		await waitForHydration(page);
		await expect(page.getByRole("link", { name: targetCharacterName }).filter({ visible: true })).toBeVisible();
		await expect(page.getByRole("button", { name: target.handle, exact: true })).toBeVisible();

		await page.goto(`/characters/${targetCharacterId}`);
		await expect(page.getByRole("link", { name: "Edit", exact: true })).toBeVisible();
	});

	await test.step("settings shows the impersonated user, stop button, and hides account deletion", async () => {
		await openSettings(page, target.handle);
		const settings = page.locator("aside#settings");
		await expect(settings).toContainText(target.handle);
		await expect(settings).toContainText(target.email);
		await expect(settings).toContainText(target.id);
		await expect(settings.getByRole("button", { name: "Stop impersonating", exact: true })).toBeVisible();
		await expect(settings.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
		await expect(settings.getByRole("button", { name: "Delete account", exact: true })).toHaveCount(0);
	});

	await test.step("stopping impersonation restores the admin session and queries", async () => {
		await page.locator("aside#settings").getByRole("button", { name: "Stop impersonating", exact: true }).click();
		await page.waitForURL(/\/admin\/users$/);

		await expect(page.getByRole("button", { name: admin.handle, exact: true })).toBeVisible();
		await expect(adminMenuButton(page)).toBeVisible();

		await openSettings(page, admin.handle);
		const settings = page.locator("aside#settings");
		await expect(settings).toContainText(admin.id);
		await expect(settings.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
		await expect(settings.getByRole("button", { name: "Stop impersonating", exact: true })).toHaveCount(0);
		await expect(settings.getByText("Danger Zone")).toBeVisible();
		await closeSettings(page);

		await page.goto("/characters");
		await expect(page.getByRole("link", { name: adminCharacterName }).filter({ visible: true })).toBeVisible();
		await expect(page.getByRole("link", { name: targetCharacterName })).toHaveCount(0);
	});

	await test.step("server rejects impersonating another admin", async () => {
		await page.goto("/admin/users");
		await searchUsers(page, target.handle);
		const row = userRow(page, target.handle);
		const response = await submitTampered(
			page,
			"impersonateUser",
			(fields) => {
				fields.userId = otherAdmin.id;
			},
			() => row.getByRole("button", { name: `Impersonate ${target.handle}`, exact: true }).click()
		);
		expect(response.body).toContain("Cannot impersonate this user");
		expect(new URL(page.url()).pathname).toBe("/admin/users");
		await expect(page.getByRole("button", { name: admin.handle, exact: true })).toBeVisible();
	});
});

test("admin ban and unban: banning revokes access, blocks impersonation, and unbanning restores access", async ({ users }) => {
	const admin = await users.signUp({ label: "banadmin", role: "admin" });
	const otherAdmin = await users.signUp({ label: "banadminb", role: "admin" });
	const target = await users.signUp({ label: "bantarget" });
	const bystander = await users.signUp({ label: "bystander" });

	const targetCharacterName = `E2E Banned Hero ${target.handle}`;
	const targetCharacterId = await createCharacter(target.page, { name: targetCharacterName });
	const banReason = "Violated Adventurers League rules";

	const { page } = admin;
	await page.goto("/admin/users");
	await searchUsers(page, target.handle);

	await test.step("cancelling or leaving the ban reason blank does not ban the user", async () => {
		const row = userRow(page, target.handle);
		await expect(row).toBeVisible();

		admin.dialogs.dismissNext();
		await row.getByRole("button", { name: `Ban ${target.handle}`, exact: true }).click();
		await expect(errorToast(page, "Reason is required")).toBeVisible();
		await expect(row).toHaveAttribute("data-banned", "false");
		expect((await userStatus(target.id))?.banned).toBe(false);

		admin.dialogs.promptNext("   ");
		await row.getByRole("button", { name: `Ban ${target.handle}`, exact: true }).click();
		await expect(row).toHaveAttribute("data-banned", "false");
		expect((await userStatus(target.id))?.banned).toBe(false);
	});

	await test.step("banning a user updates UI, persists across reload, and disables impersonation", async () => {
		const row = userRow(page, target.handle);
		admin.dialogs.promptNext(banReason);
		await row.getByRole("button", { name: `Ban ${target.handle}`, exact: true }).click();

		await expect(toast(page, `${target.handle} has been banned`)).toBeVisible();
		await expect(row).toHaveAttribute("data-banned", "true");
		await expect(row).toContainText(`Banned: ${banReason}`);
		await expect(row.getByRole("button", { name: `Impersonate ${target.handle}`, exact: true })).toBeDisabled();
		await expect(row.getByRole("button", { name: `Unban ${target.handle}`, exact: true })).toBeVisible();
		await expect(row.getByRole("button", { name: `Ban ${target.handle}`, exact: true })).toHaveCount(0);

		expect(await userStatus(target.id)).toMatchObject({ banned: true, banReason });

		await page.reload({ waitUntil: "load" });
		await waitForHydration(page);
		await searchUsers(page, target.handle);
		await expect(row).toHaveAttribute("data-banned", "true");
		await expect(row).toContainText(`Banned: ${banReason}`);
		await expect(row.getByRole("button", { name: `Impersonate ${target.handle}`, exact: true })).toBeDisabled();
		await expect(row.getByRole("button", { name: `Unban ${target.handle}`, exact: true })).toBeVisible();
	});

	await test.step("server rejects impersonating a banned user and banning admins or already-banned users", async () => {
		await searchUsers(page, bystander.handle);
		const bystanderRow = userRow(page, bystander.handle);
		await expect(bystanderRow).toBeVisible();

		const impersonateBanned = await submitTampered(
			page,
			"impersonateUser",
			(fields) => {
				fields.userId = target.id;
			},
			() => bystanderRow.getByRole("button", { name: `Impersonate ${bystander.handle}`, exact: true }).click()
		);
		expect(impersonateBanned.body).toContain("User is banned");
		expect(new URL(page.url()).pathname).toBe("/admin/users");

		admin.dialogs.promptNext("Attempt to ban admin");
		const banAdmin = await submitTampered(
			page,
			"banUser",
			(fields) => {
				fields.userId = otherAdmin.id;
			},
			() => bystanderRow.getByRole("button", { name: `Ban ${bystander.handle}`, exact: true }).click()
		);
		expect(banAdmin.body).toContain("Cannot ban admins");
		expect(await userStatus(otherAdmin.id)).toMatchObject({ banned: false });

		admin.dialogs.promptNext("Attempt to ban twice");
		const banAgain = await submitTampered(
			page,
			"banUser",
			(fields) => {
				fields.userId = target.id;
			},
			() => bystanderRow.getByRole("button", { name: `Ban ${bystander.handle}`, exact: true }).click()
		);
		expect(banAgain.body).toContain("User is already banned");
		expect(await userStatus(bystander.id)).toMatchObject({ banned: false });
	});

	await test.step("the banned user loses active sessions, cannot sign back in, and their character is hidden", async () => {
		expect(await sessionIds(target.id)).toEqual([]);

		await target.page.goto("/characters");
		await expect.poll(() => new URL(target.page.url()).pathname).toBe("/");

		const signIn = target.page.getByRole("button", { name: "Sign in with Passkey" });
		if (await signIn.isVisible()) {
			await signIn.click();
		}
		await expect(
			target.page
				.locator("[data-sonner-toast], .alert-error")
				.filter({ hasText: `You have been banned from this application. Reason: ${banReason}` })
				.first()
		).toBeVisible();
		expect(new URL(target.page.url()).pathname).toBe("/");

		const visitor = await users.visitor();
		const response = await visitor.page.goto(`/characters/${targetCharacterId}`);
		expect(response?.status()).toBe(404);
		await expect(visitor.page.locator("main").getByText("Character not found").first()).toBeVisible();
	});

	await test.step("cancelling the unban confirmation keeps the user banned", async () => {
		await searchUsers(page, target.handle);
		const row = userRow(page, target.handle);
		await expect(row).toHaveAttribute("data-banned", "true");

		admin.dialogs.dismissNext();
		await row.getByRole("button", { name: `Unban ${target.handle}`, exact: true }).click();
		await expect(row).toHaveAttribute("data-banned", "true");
		expect(await userStatus(target.id)).toMatchObject({ banned: true, banReason });
	});

	await test.step("unbanning a user restores UI state, impersonation, sign-in, and shared character visibility", async () => {
		const row = userRow(page, target.handle);
		await row.getByRole("button", { name: `Unban ${target.handle}`, exact: true }).click();

		await expect(toast(page, `${target.handle} has been unbanned`)).toBeVisible();
		await expect(row).toHaveAttribute("data-banned", "false");
		await expect(row).not.toContainText("Banned:");
		await expect(row.getByRole("button", { name: `Impersonate ${target.handle}`, exact: true })).toBeEnabled();
		await expect(row.getByRole("button", { name: `Ban ${target.handle}`, exact: true })).toBeVisible();
		await expect(row.getByRole("button", { name: `Unban ${target.handle}`, exact: true })).toHaveCount(0);

		expect(await userStatus(target.id)).toMatchObject({ banned: false, banReason: null });

		await page.reload({ waitUntil: "load" });
		await waitForHydration(page);
		await searchUsers(page, target.handle);
		await expect(row).toHaveAttribute("data-banned", "false");
		await expect(row.getByRole("button", { name: `Impersonate ${target.handle}`, exact: true })).toBeEnabled();

		await target.page.goto("/");
		const signedIn = await target.page
			.waitForURL(/\/characters$/, { timeout: 5_000 })
			.then(() => true)
			.catch(() => false);
		if (!signedIn) {
			await target.page.getByRole("button", { name: "Sign in with Passkey" }).click();
			await target.page.waitForURL(/\/characters$/);
		}
		await expect(target.page.getByRole("link", { name: targetCharacterName }).filter({ visible: true })).toBeVisible();

		const visitor = await users.visitor();
		const response = await visitor.page.goto(`/characters/${targetCharacterId}`);
		expect(response?.ok()).toBe(true);
		await expect(visitor.page.getByRole("heading", { name: targetCharacterName })).toBeVisible();
	});
});

test("admin logs: searching, toggling details, and deleting app logs", async ({ users }) => {
	const admin = await users.signUp({ label: "logsadmin", role: "admin" });
	const label = `e2e-admin-log-${uniqueStamp()}`;
	await insertAppLogs(label, [0]);

	try {
		const { page } = admin;
		await page.goto("/admin/logs");

		await test.step("search filters to the matching log and toggles its details", async () => {
			await page.locator("#log-search").fill(`label:"${label}"`);
			const logBody = page.locator("tbody").filter({ hasText: label });
			await expect(logBody).toBeVisible();
			await expect(logBody).toHaveAttribute("data-details", "false");

			await logBody.getByRole("button", { name: "Toggle details", exact: true }).filter({ visible: true }).click();
			await expect(logBody).toHaveAttribute("data-details", "true");
			await expect(logBody.getByText("Annotations")).toBeVisible();
		});

		await test.step("deleting the log removes it from the UI and database", async () => {
			const logBody = page.locator("tbody").filter({ hasText: label });
			await logBody.getByRole("button", { name: "Delete log", exact: true }).filter({ visible: true }).click();

			await expect(toast(page, "Log deleted")).toBeVisible();
			await expect(logBody).toHaveCount(0);
			await expect.poll(() => appLogIds(label)).toEqual([]);
		});
	} finally {
		await deleteAppLogs(label);
	}
});

test("admin user detail: profile, session revocation, and deleting a user", async ({ users }) => {
	const admin = await users.signUp({ label: "detailadmin", role: "admin" });
	const otherAdmin = await users.signUp({ label: "detailadminb", role: "admin" });
	const member = await users.signUp({ label: "detailmember" });
	const target = await users.signUp({ label: "detailtarget" });

	const characterName = `E2E Detail Hero ${target.handle}`;
	const characterId = await createCharacter(target.page, { name: characterName });
	await setCharacterImageBytes(characterId, 2 * 1024 * 1024);

	const [revokeOneId, keepId, expiredId] = await insertSessions(target.id, [3_600_000, 7_200_000, -3_600_000]);
	if (!revokeOneId || !keepId || !expiredId) throw new Error("Expected three inserted sessions");
	const activeCount = (await sessionIds(target.id)).length - 1;

	const { page } = admin;
	const sessionRow = (id: string) => page.locator(`tr[data-session-id="${id}"]`);

	await test.step("the users list links to the detail page", async () => {
		await page.goto("/admin/users");
		await searchUsers(page, target.handle);
		await userRow(page, target.handle).getByRole("link", { name: target.handle, exact: true }).click();
		await page.waitForURL(new RegExp(`/admin/users/${target.id}$`));
	});

	await test.step("the page shows the account, passkeys, characters, storage and active sessions", async () => {
		await expect(page.getByRole("heading", { name: target.handle })).toBeVisible();
		await expect(page.getByText(target.email)).toBeVisible();
		await expect(page.getByTestId("onboarded")).toHaveText("Yes");
		await expect(page.getByTestId("last-session")).not.toHaveText("Never");
		await expect(page.getByTestId("storage-use")).toContainText(/^2 MB \//);
		await expect(page.getByRole("list", { name: "Accounts" })).toContainText("No linked providers");
		await expect(page.getByRole("list", { name: "Passkeys" }).getByRole("listitem")).toHaveCount(1);
		const characterCard = page.getByRole("list", { name: "Characters" }).getByRole("listitem").filter({ hasText: characterName });
		await expect(characterCard).toHaveCount(1);
		await expect(characterCard).toContainText("Level 1");
		await expect(characterCard.getByRole("link", { name: characterName })).toHaveAttribute("href", `/characters/${characterId}`);

		await expect(page.getByRole("heading", { name: `Active sessions (${activeCount})` })).toBeVisible();
		await expect(sessionRow(revokeOneId)).toBeVisible();
		await expect(sessionRow(keepId)).toBeVisible();
		await expect(sessionRow(expiredId)).toHaveCount(0);
		await expect(sessionRow(revokeOneId)).toContainText("Unknown");
	});

	await test.step("only admins can open the page or call the admin commands", async () => {
		await member.page.goto(`/admin/users/${target.id}`);
		await expect(member.page).toHaveURL(/\/characters$/);

		const revokeAll = await callCommand(member.page, "src/lib/remote/admin/actions.remote.ts", "revokeAllUserSessions", {
			userId: target.id
		});
		expect(revokeAll.ok).toBe(false);
		const revokeOne = await callCommand(member.page, "src/lib/remote/admin/actions.remote.ts", "revokeUserSession", {
			userId: target.id,
			sessionId: keepId
		});
		expect(revokeOne.ok).toBe(false);
		expect(await sessionIds(target.id)).toContain(keepId);
	});

	await test.step("a session id from another account cannot be revoked through this user", async () => {
		const otherSessions = await sessionIds(member.id);
		const memberSessionId = otherSessions[0];
		if (!memberSessionId) throw new Error("Expected the member to have a session");

		const result = await callCommand(page, "src/lib/remote/admin/actions.remote.ts", "revokeUserSession", {
			userId: target.id,
			sessionId: memberSessionId
		});
		expect(result.ok).toBe(false);
		expect(result.error?.status).toBe(404);
		expect(await sessionIds(member.id)).toContain(memberSessionId);
	});

	await test.step("revoking one session removes only that session", async () => {
		await sessionRow(revokeOneId).getByRole("button", { name: "Revoke session", exact: true }).click();
		await expect(toast(page, "Session revoked")).toBeVisible();
		await expect(sessionRow(revokeOneId)).toHaveCount(0);
		await expect(sessionRow(keepId)).toBeVisible();

		const remaining = await sessionIds(target.id);
		expect(remaining).not.toContain(revokeOneId);
		expect(remaining).toContain(keepId);
		await expect(page.getByRole("heading", { name: `Active sessions (${activeCount - 1})` })).toBeVisible();
	});

	await test.step("revoking all sessions signs the user out", async () => {
		await page.getByRole("button", { name: "Revoke all sessions", exact: true }).click();
		await expect(toast(page, "All sessions revoked")).toBeVisible();
		await expect(page.getByText("No active sessions")).toBeVisible();
		expect(await sessionIds(target.id)).toEqual([]);

		await target.page.goto("/characters");
		await expect.poll(() => new URL(target.page.url()).pathname).toBe("/");
	});

	await test.step("admin accounts cannot have sessions revoked or be deleted", async () => {
		await page.goto(`/admin/users/${otherAdmin.id}`);
		await expect(page.getByRole("heading", { name: otherAdmin.handle })).toBeVisible();
		await expect(page.getByRole("button", { name: "Revoke all sessions", exact: true })).toBeDisabled();
		await expect(page.getByRole("button", { name: "Delete user", exact: true })).toBeDisabled();

		const sessionsBefore = await sessionIds(otherAdmin.id);
		const result = await callCommand(page, "src/lib/remote/admin/actions.remote.ts", "revokeAllUserSessions", {
			userId: otherAdmin.id
		});
		expect(result.ok).toBe(false);
		// Command errors carry the pretty-printed cause, so the message is prefixed with the error tag.
		expect(result.error?.message).toContain("Cannot revoke sessions of admin accounts");
		expect(result.error?.status).toBe(403);
		expect(await sessionIds(otherAdmin.id)).toEqual(sessionsBefore);
	});

	await test.step("deleting requires the confirmation, and the server enforces it and the admin rule", async () => {
		await page.goto(`/admin/users/${target.id}`);
		await page.getByRole("button", { name: "Delete user", exact: true }).click();
		const dialog = page.getByRole("dialog");
		const confirm = dialog.getByRole("button", { name: "Delete user", exact: true });
		await expect(confirm).toBeDisabled();

		const segment = (await dialog.locator("span.text-error").innerText()).trim();
		expect(target.id.endsWith(segment)).toBe(true);

		await dialog.getByPlaceholder("Last segment").fill("wrong");
		await expect(confirm).toBeDisabled();
		await dialog.getByPlaceholder("Last segment").fill(segment.toUpperCase());
		await expect(confirm).toBeEnabled();

		const wrongConfirmation = await submitTampered(
			page,
			"deleteUser",
			(fields) => {
				fields.confirmation = "wrong";
			},
			() => confirm.click()
		);
		expect(wrongConfirmation.body).toContain("Enter the last segment of the user ID to confirm");
		expect(await userStatus(target.id)).not.toBeNull();

		const deleteAdmin = await submitTampered(
			page,
			"deleteUser",
			(fields) => {
				fields.userId = otherAdmin.id;
			},
			() => confirm.click()
		);
		expect(deleteAdmin.body).toContain("Cannot delete admin accounts");
		expect(await userStatus(otherAdmin.id)).not.toBeNull();
		expect(await userStatus(target.id)).not.toBeNull();
	});

	await test.step("confirming deletes the user and their records, then returns to the list", async () => {
		await page.getByRole("dialog").getByRole("button", { name: "Delete user", exact: true }).click();
		await page.waitForURL(/\/admin\/users$/);

		expect(await userStatus(target.id)).toBeNull();
		expect(await characterRow(characterId)).toBeNull();

		await searchUsers(page, target.handle);
		await expect(userRow(page, target.handle)).toHaveCount(0);
	});
});
