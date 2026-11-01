import { expect, test } from "./fixtures.ts";
import { characterIdFromUrl, fillCharacterForm, keyFromUrl } from "./records.ts";
import { objectExists, waitUntilMissing } from "./storage.ts";
import { uploadCharacterImage } from "./ui.ts";

test("characters: create, portrait, edit, search, and delete", async ({ users }) => {
	const { page, handle } = await users.signUp({ label: "characters" });
	const characterName = `E2E ${handle}`;
	const secondCharacterName = `E2E Companion ${handle}`;
	let characterId = "";
	let portraitKey = "";

	await test.step("create the first character with a portrait", async () => {
		await page.getByRole("link", { name: "Create your first character" }).click();
		await page.waitForURL(/\/characters\/new\/edit$/);
		await fillCharacterForm(page, { name: characterName, race: "Elf", className: "Fighter" });
		const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Save Character" }) });
		const stagedPortrait = keyFromUrl(await uploadCharacterImage(form));
		await page.getByRole("button", { name: "Save Character" }).click();
		await page.waitForURL(/\/characters\/[0-9a-f-]{36}$/iu);
		characterId = characterIdFromUrl(page.url()) ?? "";
		expect(characterId).not.toBe("");

		portraitKey = keyFromUrl(await page.locator(`img[alt="${characterName}"]`).first().getAttribute("src"));
		expect(portraitKey).toBe(stagedPortrait.replace(/^tmp\//, ""));
		await expect.poll(() => objectExists(portraitKey)).toBe(true);
		await waitUntilMissing(stagedPortrait);
		await expect(page.getByText("Elf")).toBeVisible();
		await expect(page.getByText("Fighter")).toBeVisible();
	});

	await test.step("create a second character from the list", async () => {
		await page.goto("/characters");
		const create = page.getByRole("link", { name: /New/ }).filter({ visible: true });
		await expect(create).toHaveAttribute("href", /draft=/);
		await create.click();
		await page.waitForURL(/\/characters\/new\/edit/);

		await fillCharacterForm(page, { name: secondCharacterName, race: "Dwarf", className: "Cleric" });
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

	await test.step("edit the character", async () => {
		await page.getByRole("link", { name: "Edit" }).click();
		await page.waitForURL(new RegExp(`/characters/${characterId}/edit$`));
		await page.getByLabel("Class").fill("Wizard");
		await page.getByRole("button", { name: "Save Character" }).click();
		await page.waitForURL(new RegExp(`/characters/${characterId}$`));
		await expect(page.getByText("Elf Wizard")).toBeVisible();
	});

	await test.step("search for the character", async () => {
		await page.goto("/characters");
		await page.getByRole("textbox", { name: "Search by name, class, items, etc." }).fill(characterName);
		await expect(page.getByRole("link", { name: characterName })).toBeVisible();
		await page.getByRole("button", { name: "Clear Search" }).click();
		await page.getByRole("link", { name: characterName }).click();
		await page.waitForURL(new RegExp(`/characters/${characterId}$`));
	});

	await test.step("delete the character and its portrait", async () => {
		await page.getByRole("button", { name: "Menu" }).click();
		await page.getByRole("button", { name: "Delete Character" }).click();
		await page.waitForURL(/\/characters$/);
		await expect(page.getByRole("link", { name: characterName })).toHaveCount(0);
		await expect(page.getByRole("link", { name: secondCharacterName }).filter({ visible: true })).toBeVisible();
		await waitUntilMissing(portraitKey);
	});
});
