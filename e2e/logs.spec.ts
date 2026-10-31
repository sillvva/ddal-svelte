import { expect, test } from "./fixtures.ts";
import { addedItemCards, createCharacter, logIdOnCharacterPage, magicItems, setLogYear } from "./records.ts";

test("character logs: items, DMs, non-game logs, edits, and deletes", async ({ users }) => {
	const { page, handle } = await users.signUp({ label: "logs" });
	const gainTitle = `E2E Item Gain ${handle}`;
	const editedGainTitle = `${gainTitle} Edited`;
	const purchaseTitle = `E2E Purchase ${handle}`;
	const lossTitle = `E2E Item Loss ${handle}`;
	const dmName = `E2E Guest ${handle}`;
	const itemName = `Cloak of E2E ${handle}`;
	const characterId = await createCharacter(page, { name: `E2E Logs ${handle}` });
	let gainLogId = "";

	await test.step("create a game log that adds a magic item and a DM", async () => {
		await page.getByRole("link", { name: "Create a Game Log" }).click();
		await page.waitForURL(new RegExp(`/characters/${characterId}/log/new`));
		await page.getByLabel("Title").fill(gainTitle);
		await page.getByLabel("DM Name").fill(dmName);
		await page.keyboard.press("Escape");
		await page.getByLabel("Level").fill("1");
		await page.getByLabel("Notes").first().fill("Gained a cloak.");
		await page.getByRole("button", { name: "Add Magic Item" }).first().click();
		const card = addedItemCards(page).first();
		await card.getByLabel("Name").fill(itemName);
		await card.getByLabel("Notes").fill("Keeps the rain off.");
		await page.getByRole("button", { name: "Save Log" }).click();
		await page.waitForURL(new RegExp(`/characters/${characterId}$`));

		gainLogId = await logIdOnCharacterPage(page, gainTitle);
		await expect(page.getByRole("link", { name: dmName })).toHaveAttribute("href", /^\/dms\/[0-9a-f-]{36}$/iu);
		await expect(magicItems(page)).toContainText(itemName);
	});

	await test.step("a backdated log does not offer an item acquired later", async () => {
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

	await test.step("drop the magic item in a later log", async () => {
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
});
