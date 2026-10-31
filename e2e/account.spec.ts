import { assertUserGone } from "./cleanup-users.ts";
import { expect, finishOnboarding, test } from "./fixtures.ts";
import { fillCharacterForm, headerAvatar, keyFromUrl } from "./records.ts";
import { listUserObjects, objectExists, waitUntilMissing } from "./storage.ts";
import { closeSettings, openSettings, saveStorageState, uploadAvatar, uploadCharacterImage } from "./ui.ts";

test("account lifecycle: onboarding, sign-in, settings, and deletion", async ({ users }) => {
	const user = await users.signUp({ label: "account", onboard: false });
	const { page, context, dialogs, handle } = user;
	const imageKeys = { firstAvatar: "", replacedAvatar: "", character: "", staged: "" };

	await test.step("finish onboarding with a profile picture", async () => {
		const form = page.locator("form").filter({ has: page.getByLabel("Username") });
		const stagedAvatar = keyFromUrl(await uploadAvatar(form));
		await finishOnboarding(page, handle, user.email);
		await expect(page.getByText("No characters found.")).toBeVisible();

		const savedAvatar = keyFromUrl(await headerAvatar(page).getAttribute("src"));
		expect(savedAvatar.startsWith("tmp/")).toBe(false);
		expect(savedAvatar).toBe(stagedAvatar.replace(/^tmp\//, ""));
		imageKeys.firstAvatar = savedAvatar;
		await expect.poll(() => objectExists(savedAvatar)).toBe(true);
		await waitUntilMissing(stagedAvatar);
		await saveStorageState(context);
	});

	await test.step("sign out and sign in again with the same passkey", async () => {
		await openSettings(page, handle);
		await expect(page.getByRole("button", { name: "Rename Passkey" })).toBeVisible();
		await page.getByRole("button", { name: "Sign out" }).click();
		await page.waitForURL((url) => url.pathname === "/");

		const signedIn = await page
			.waitForURL(/\/characters$/, { timeout: 15_000 })
			.then(() => true)
			.catch(() => false);
		if (!signedIn) {
			await page.getByRole("button", { name: "Sign in with Passkey" }).click();
			await page.waitForURL(/\/characters$/);
		}
		await expect(page.getByRole("button", { name: handle, exact: true })).toBeVisible();
	});

	await test.step("change settings: avatar, theme, layout, and passkey name", async () => {
		await openSettings(page, handle);
		const shownId = await page.locator("aside#settings").getByText("User ID:").locator("xpath=..").innerText();
		expect(shownId).toContain(user.id);

		await page.getByRole("button", { name: "Change profile picture" }).click();
		const dialog = page.getByRole("dialog").filter({ has: page.getByRole("img", { name: "Profile picture" }) });
		const staged = keyFromUrl(await uploadAvatar(dialog));
		expect(staged.startsWith("tmp/")).toBe(true);
		await dialog.getByRole("button", { name: "Save", exact: true }).click();
		await expect(dialog).toBeHidden();

		const previousFile = imageKeys.firstAvatar.split("/").pop() ?? imageKeys.firstAvatar;
		await expect.poll(async () => (await headerAvatar(page).getAttribute("src")) ?? "").not.toContain(previousFile);
		await expect.poll(async () => (await headerAvatar(page).getAttribute("src")) ?? "").toMatch(/\/avatar\//);
		imageKeys.replacedAvatar = keyFromUrl(await headerAvatar(page).getAttribute("src"));
		expect(imageKeys.replacedAvatar).not.toBe(imageKeys.firstAvatar);
		expect(imageKeys.replacedAvatar.startsWith("tmp/")).toBe(false);
		await waitUntilMissing(imageKeys.firstAvatar);
		await expect.poll(() => objectExists(imageKeys.replacedAvatar)).toBe(true);
		await waitUntilMissing(staged);

		await page.locator("aside#settings").getByRole("button", { name: "System" }).click();
		await page.getByRole("dialog").getByRole("button", { name: "Retro" }).click();
		await expect(page.locator("html")).toHaveAttribute("data-theme", "retro");
		await page.getByRole("dialog").getByRole("button", { name: "Close" }).first().click();

		await page.locator("aside#settings select").selectOption("full");
		await expect(page.locator("main")).toHaveAttribute("data-maxwidth", "full");

		dialogs.promptNext("E2E Laptop");
		await page.getByRole("button", { name: "Rename Passkey" }).click();
		await expect(page.getByRole("button", { name: "Rename Passkey" })).toContainText("E2E Laptop");
		await closeSettings(page);
	});

	await test.step("save a portrait and leave another staged", async () => {
		await page.goto("/characters/new/edit");
		const name = `E2E Portrait ${handle}`;
		await fillCharacterForm(page, { name });
		const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Save Character" }) });
		const stagedPortrait = keyFromUrl(await uploadCharacterImage(form));
		await page.getByRole("button", { name: "Save Character" }).click();
		await page.waitForURL(/\/characters\/[0-9a-f-]{36}$/iu);
		const characterUrl = page.url();

		imageKeys.character = keyFromUrl(await page.locator(`img[alt="${name}"]`).first().getAttribute("src"));
		expect(imageKeys.character).toBe(stagedPortrait.replace(/^tmp\//, ""));
		await expect.poll(() => objectExists(imageKeys.character)).toBe(true);
		await waitUntilMissing(stagedPortrait);

		await page.goto(`${characterUrl}/edit`);
		imageKeys.staged = keyFromUrl(await uploadCharacterImage(form));
		expect(imageKeys.staged.startsWith("tmp/")).toBe(true);
		await page.goto(characterUrl);
		await expect.poll(() => objectExists(imageKeys.staged)).toBe(true);
		await expect.poll(() => objectExists(imageKeys.character)).toBe(true);
	});

	await test.step("delete the account and prove its images are gone", async () => {
		await openSettings(page, handle);
		// The account settings collapse wraps this one, so both contain the "Danger Zone" text.
		// DaisyUI stretches an invisible checkbox over the title. Its box is not a reliable click target.
		const danger = page.locator("aside#settings .collapse").filter({ hasText: "Danger Zone" }).last();
		await danger.locator('input[type="checkbox"]').evaluate((node) => {
			if (!(node instanceof HTMLInputElement)) throw new Error("Danger Zone toggle is not a checkbox");
			node.checked = true;
		});
		await danger.getByRole("button", { name: "Delete account" }).click();

		const segment = (await page.locator("dialog span.text-error").innerText()).trim();
		expect(user.id.endsWith(segment)).toBe(true);
		await page.getByPlaceholder("Last segment").fill(segment);
		await page.locator("dialog").getByRole("button", { name: "Delete account" }).click();
		await page.waitForURL((url) => url.pathname === "/");
		await expect(page.getByRole("button", { name: "Sign in with Passkey" })).toBeVisible();

		for (const key of [imageKeys.replacedAvatar, imageKeys.character]) {
			await waitUntilMissing(key);
		}
		// Unsaved `tmp/` uploads are left for the bucket lifecycle rule (about a day).
		await expect.poll(() => objectExists(imageKeys.staged)).toBe(true);
		await expect.poll(async () => (await listUserObjects(user.id)).filter((key) => !key.startsWith("tmp/"))).toEqual([]);
		await assertUserGone(user.id);
	});
});
