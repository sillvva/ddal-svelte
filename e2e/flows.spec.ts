import { expect, test, type Page } from "@playwright/test";
import { assertUserGone, userIdForSessionCookies } from "./cleanup-users.ts";
import { assertLocalE2E } from "./env.ts";
import { rememberUser } from "./state.ts";
import { keyFromPublicUrl, listUserObjects, objectExists, waitUntilMissing } from "./storage.ts";
import {
	acceptDialogs,
	characterIdFromUrl,
	closeSettings,
	installPasskeyAuthenticator,
	logIdFromHref,
	openSettings,
	saveStorageState,
	settleNavigations,
	uploadAvatar,
	uploadCharacterImage
} from "./ui.ts";

test.describe.configure({ mode: "serial" });

test("End-to-end passkey user flow", async ({ browser }) => {
	assertLocalE2E(process.env);

	const stamp = Date.now().toString(36);
	const handle = `e2e-${stamp}`;
	const email = `${handle}@example.com`;
	const characterName = `E2E ${stamp}`;
	const secondCharacterName = `E2E Companion ${stamp}`;
	const dmName = `E2E Guest ${stamp}`;
	const editedDmName = `${dmName} Edited`;
	const gainTitle = `E2E Item Gain ${stamp}`;
	const editedGainTitle = `${gainTitle} Edited`;
	const purchaseTitle = `E2E Purchase ${stamp}`;
	const lossTitle = `E2E Item Loss ${stamp}`;
	const dmLogTitle = `E2E DM Session ${stamp}`;
	const secondDmLogTitle = `E2E DM Session Two ${stamp}`;
	const itemName = `Cloak of E2E ${stamp}`;

	const context = await browser.newContext();
	const page = await context.newPage();
	settleNavigations(page);
	const dialogs = acceptDialogs(page);
	await installPasskeyAuthenticator(context);

	let userId = "";
	let characterId = "";
	let gainLogId = "";
	let dmId = "";
	const imageKeys = {
		firstAvatar: "",
		replacedAvatar: "",
		character: "",
		staged: ""
	};

	try {
		await test.step("sign up with a passkey and finish onboarding", async () => {
			await page.goto("/");
			const create = page.getByRole("button", { name: "Create an account with a passkey" });
			await expect(create, "Passkey sign-up is hidden. Leave DISABLE_SIGNUPS unset for the local app.").toBeVisible();
			await create.click();
			await page.waitForURL(/\/onboarding$/);

			userId = (await userIdForSessionCookies(await context.cookies())) ?? "";
			expect(userId, "The new session did not resolve to a user id").not.toBe("");
			rememberUser(userId);

			const form = page.locator("form").filter({ has: page.getByLabel("Username") });
			imageKeys.firstAvatar = keyFromUrl(await uploadAvatar(form));
			await page.getByLabel("Username").fill(handle);
			await page.getByLabel("Email").fill(email);
			await page.getByRole("button", { name: "Continue" }).click();
			await page.waitForURL(/\/characters$/);
			await expect(page.getByText("No characters found.")).toBeVisible();

			const stagedAvatar = imageKeys.firstAvatar;
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
			expect(shownId).toContain(userId);

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

		await test.step("create a character and upload a portrait", async () => {
			await page.getByRole("link", { name: "Create your first character" }).click();
			await page.waitForURL(/\/characters\/new\/edit$/);
			const starting = page.getByRole("checkbox", { name: "Create Starting Log" });
			if (await starting.isChecked()) await starting.uncheck();

			await page.getByLabel("Character Name").fill(characterName);
			await page.getByLabel("Campaign").fill("E2E Campaign");
			await page.getByLabel("Species").fill("Elf");
			await page.getByLabel("Class").fill("Fighter");
			const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Save Character" }) });
			const stagedPortrait = keyFromUrl(await uploadCharacterImage(form));
			await page.getByRole("button", { name: "Save Character" }).click();
			await page.waitForURL(/\/characters\/[0-9a-f-]{36}$/iu);
			characterId = characterIdFromUrl(page.url()) ?? "";
			expect(characterId).not.toBe("");

			imageKeys.character = keyFromUrl(await page.locator(`img[alt="${characterName}"]`).first().getAttribute("src"));
			expect(imageKeys.character).toBe(stagedPortrait.replace(/^tmp\//, ""));
			await expect.poll(() => objectExists(imageKeys.character)).toBe(true);
			await waitUntilMissing(stagedPortrait);
			await expect(page.getByText("Elf")).toBeVisible();
			await expect(page.getByText("Fighter")).toBeVisible();
		});

		await test.step("create a second character", async () => {
			await page.goto("/characters");
			const create = page.getByRole("link", { name: /New/ }).filter({ visible: true });
			await expect(create).toHaveAttribute("href", /draft=/);
			await create.click();
			await page.waitForURL(/\/characters\/new\/edit/);

			const starting = page.getByRole("checkbox", { name: "Create Starting Log" });
			if (await starting.isChecked()) await starting.uncheck();
			await page.getByLabel("Character Name").fill(secondCharacterName);
			await page.getByLabel("Campaign").fill("E2E Campaign");
			await page.getByLabel("Species").fill("Dwarf");
			await page.getByLabel("Class").fill("Cleric");
			await page.getByRole("button", { name: "Save Character" }).click();
			await page.waitForURL(/\/characters\/[0-9a-f-]{36}$/iu);
			const secondId = characterIdFromUrl(page.url()) ?? "";
			expect(secondId).not.toBe("");
			expect(secondId).not.toBe(characterId);

			await page.goto("/characters");
			const firstLink = page.getByRole("link", { name: characterName }).filter({ visible: true });
			const secondLink = page.getByRole("link", { name: secondCharacterName }).filter({ visible: true });
			await expect(firstLink).toBeVisible();
			await expect(secondLink).toBeVisible();
			expect(await firstLink.getAttribute("href")).not.toBe(await secondLink.getAttribute("href"));
			await firstLink.click();
			await page.waitForURL(new RegExp(`/characters/${characterId}$`));
		});

		await test.step("edit the character and leave a staged portrait unsaved", async () => {
			await page.getByRole("link", { name: "Edit" }).click();
			await page.waitForURL(new RegExp(`/characters/${characterId}/edit$`));
			await page.getByLabel("Class").fill("Wizard");
			await page.getByRole("button", { name: "Save Character" }).click();
			await page.waitForURL(new RegExp(`/characters/${characterId}$`));
			await expect(page.getByText("Elf Wizard")).toBeVisible();

			await page.goto(`/characters/${characterId}/edit`);
			const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Save Character" }) });
			imageKeys.staged = keyFromUrl(await uploadCharacterImage(form));
			expect(imageKeys.staged.startsWith("tmp/")).toBe(true);
			await page.goto(`/characters/${characterId}`);
			await expect.poll(() => objectExists(imageKeys.staged)).toBe(true);
			await expect.poll(() => objectExists(imageKeys.character)).toBe(true);
		});

		await test.step("search for the character", async () => {
			await page.goto("/characters");
			await page.getByRole("textbox", { name: "Search by name, class, items, etc." }).fill(characterName);
			await expect(page.getByRole("link", { name: characterName })).toBeVisible();
			await page.getByRole("button", { name: "Clear Search" }).click();
			await page.getByRole("link", { name: characterName }).click();
			await page.waitForURL(new RegExp(`/characters/${characterId}$`));
		});

		await test.step("create a game log that adds a magic item and a DM", async () => {
			await page.getByRole("link", { name: "Create a Game Log" }).click();
			await page.waitForURL(new RegExp(`/characters/${characterId}/log/new`));
			await page.getByLabel("Title").fill(gainTitle);
			await page.getByLabel("DM Name").fill(dmName);
			await page.keyboard.press("Escape");
			await page.getByLabel("Level").fill("1");
			await page.getByLabel("Notes").first().fill("Gained a cloak.");
			await page.getByRole("button", { name: "Add Magic Item" }).first().click();
			const card = page.locator(".card").filter({ has: page.getByRole("heading", { name: "Add Magic Item" }) });
			await card.getByLabel("Name").fill(itemName);
			await card.getByLabel("Notes").fill("Keeps the rain off.");
			await page.getByRole("button", { name: "Save Log" }).click();
			await page.waitForURL(new RegExp(`/characters/${characterId}$`));

			const gainLink = page.getByRole("link", { name: gainTitle });
			gainLogId = logIdFromHref(await gainLink.getAttribute("href")) ?? "";
			expect(gainLogId).not.toBe("");
			dmId = (await page.getByRole("link", { name: dmName }).getAttribute("href"))?.split("/").pop() ?? "";
			expect(dmId).toMatch(/^[0-9a-f-]{36}$/iu);
			await expect(magicItems(page)).toContainText(itemName);
		});

		await test.step("a backdated log cannot drop an item acquired later", async () => {
			await page.getByRole("link", { name: "New Log" }).click();
			await page.waitForURL(new RegExp(`/characters/${characterId}/log/new`));
			await expect(page.getByRole("button", { name: "Remove Magic Item" })).toBeVisible();
			await setLogYear(page, "2015");
			await expect(page.getByRole("button", { name: "Remove Magic Item" })).toHaveCount(0);
			await page.goto(`/characters/${characterId}`);
		});

		await test.step("create a non-game log", async () => {
			await page.getByRole("link", { name: "New Log" }).click();
			await page.getByLabel("Log Type").selectOption("nongame");
			await page.getByLabel("Title").fill(purchaseTitle);
			await page.getByLabel("Gold").fill("25");
			await page.getByRole("button", { name: "Save Log" }).click();
			await page.waitForURL(new RegExp(`/characters/${characterId}$`));
			await expect(page.getByRole("link", { name: purchaseTitle })).toBeVisible();
			await expect(page.getByText("25", { exact: true })).toBeVisible();
		});

		await test.step("remove the magic item in a later log", async () => {
			await page.getByRole("link", { name: "New Log" }).click();
			await page.getByLabel("Title").fill(lossTitle);
			await page.getByRole("button", { name: "Remove Magic Item" }).click();
			await expect(page.getByRole("heading", { name: "Drop Magic Item" })).toBeVisible();
			await expect(page.getByLabel("Select an Item").locator("option:checked")).toHaveText(new RegExp(itemName));
			await page.getByRole("button", { name: "Save Log" }).click();
			await page.waitForURL(new RegExp(`/characters/${characterId}$`));
			await expect(magicItems(page)).toHaveText("None");
			await expect(page.getByRole("link", { name: lossTitle })).toBeVisible();
		});

		await test.step("edit a log", async () => {
			await page.getByRole("link", { name: gainTitle }).click();
			await page.waitForURL(new RegExp(`/characters/${characterId}/log/${gainLogId}$`));
			await page.getByLabel("Title").fill(editedGainTitle);
			await page.getByRole("button", { name: "Save Log" }).click();
			await page.waitForURL(new RegExp(`/characters/${characterId}$`));
			await expect(page.getByRole("link", { name: editedGainTitle })).toBeVisible();
			await expect(page.getByRole("link", { name: gainTitle, exact: true })).toHaveCount(0);
		});

		await test.step("delete a log", async () => {
			await page.locator("tbody").filter({ hasText: purchaseTitle }).getByRole("button", { name: "Delete Log" }).click();
			await expect(page.getByRole("link", { name: purchaseTitle })).toHaveCount(0);
		});

		await test.step("create two DM logs assigned to the character", async () => {
			await page.goto("/dm-logs");
			await page.getByRole("link", { name: "New Log" }).filter({ visible: true }).click();
			await page.waitForURL(/\/dm-logs\/new/);
			await page.getByLabel("Title").fill(dmLogTitle);
			await assignCharacter(page, characterName);
			await page.getByRole("button", { name: "Save Log" }).click();
			await page.waitForURL(/\/dm-logs$/);

			const createAnother = page.getByRole("link", { name: "New Log" }).filter({ visible: true });
			await expect(createAnother).toHaveAttribute("href", /draft=/);
			await createAnother.click();
			await page.waitForURL(/\/dm-logs\/new\?draft=/);
			await page.getByLabel("Title").fill(secondDmLogTitle);
			await assignCharacter(page, characterName);
			await page.getByRole("button", { name: "Save Log" }).click();
			await page.waitForURL(/\/dm-logs$/);

			// Mobile and desktop lists both render each link; only one copy is visible.
			const firstLog = page.locator('a[href^="/dm-logs/"]', { hasText: dmLogTitle }).filter({ visible: true });
			const secondLog = page.locator('a[href^="/dm-logs/"]', { hasText: secondDmLogTitle }).filter({ visible: true });
			await expect(firstLog).toBeVisible();
			await expect(secondLog).toBeVisible();
			const firstHref = await firstLog.getAttribute("href");
			const secondHref = await secondLog.getAttribute("href");
			expect(logIdFromHref(firstHref)).not.toBe("");
			expect(logIdFromHref(secondHref)).not.toBe("");
			expect(firstHref).not.toBe(secondHref);
		});

		await test.step("edit the DM", async () => {
			await page.goto(`/dms/${dmId}`);
			await page.getByLabel("DM Name").fill(editedDmName);
			await page.getByLabel("DCI").fill("424242");
			await page.getByRole("button", { name: "Save DM" }).click();
			await page.waitForURL(/\/dms$/);
			const editedDm = page.locator(`a[href="/dms/${dmId}"]`, { hasText: editedDmName });
			await expect(editedDm).toBeVisible();
			await expect(page.getByRole("cell", { name: "424242" })).toBeVisible();
		});

		await test.step("delete the DM after its log is gone", async () => {
			await page.goto(`/characters/${characterId}`);
			await page.locator("tbody").filter({ hasText: editedGainTitle }).getByRole("button", { name: "Delete Log" }).click();
			await expect(page.getByRole("link", { name: editedGainTitle })).toHaveCount(0);

			await page.goto("/dms");
			const editedDm = page.locator("tr").filter({ hasText: editedDmName });
			await editedDm.getByRole("button", { name: "Delete DM" }).click();
			await expect(page.locator(`a[href="/dms/${dmId}"]`)).toHaveCount(0);
		});

		await test.step("delete the character and the remaining DM log", async () => {
			await page.goto(`/characters/${characterId}`);
			await page.getByRole("button", { name: "Menu" }).click();
			await page.getByRole("button", { name: "Delete Character" }).click();
			await page.waitForURL(/\/characters$/);
			await expect(page.getByRole("link", { name: characterName })).toHaveCount(0);

			await page.goto("/dm-logs");
			await page.locator("tbody").filter({ hasText: dmLogTitle }).getByRole("button", { name: "Delete Log" }).click();
			await expect(page.locator('a[href^="/dm-logs/"]', { hasText: dmLogTitle })).toHaveCount(0);
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
			expect(userId.endsWith(segment)).toBe(true);
			await page.getByPlaceholder("Last segment").fill(segment);
			await page.locator("dialog").getByRole("button", { name: "Delete account" }).click();
			await page.waitForURL((url) => url.pathname === "/");
			await expect(page.getByRole("button", { name: "Sign in with Passkey" })).toBeVisible();

			for (const key of [imageKeys.replacedAvatar, imageKeys.character]) {
				await waitUntilMissing(key);
			}
			// Unsaved `tmp/` uploads are left for the bucket lifecycle rule (about a day).
			await expect.poll(() => objectExists(imageKeys.staged)).toBe(true);
			await expect.poll(async () => (await listUserObjects(userId)).filter((key) => !key.startsWith("tmp/"))).toEqual([]);
			await assertUserGone(userId);
		});
	} finally {
		await context.close();
	}
});

async function setLogYear(page: Page, year: string) {
	const segment = page.getByRole("spinbutton", { name: "year" });
	await segment.click();
	await segment.pressSequentially(year);
}

async function assignCharacter(page: Page, name: string) {
	const assigned = page.getByLabel("Assigned Character");
	// Bits UI opens this combobox on keydown, not on a programmatic value change.
	await assigned.fill(name);
	await assigned.press("ArrowDown");
	await page.getByRole("option", { name }).click();
}

function headerAvatar(page: Page) {
	return page.locator("header button img");
}

function magicItems(page: Page) {
	// The heading sits in a wrapper; the item list is the wrapper's next sibling, not the heading's.
	return page.getByRole("heading", { name: "Magic Items", exact: true }).locator("xpath=../following-sibling::p[1]");
}

function keyFromUrl(imageUrl: string | null) {
	if (!imageUrl) throw new Error("Expected an image URL");
	const key = keyFromPublicUrl(imageUrl);
	if (!key) throw new Error(`Image URL is not in the configured bucket: ${imageUrl}`);
	return key;
}
