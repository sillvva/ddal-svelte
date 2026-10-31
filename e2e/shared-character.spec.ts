import type { Page } from "@playwright/test";
import { setBanned } from "./db.ts";
import { expect, test } from "./fixtures.ts";
import { createCharacter, createGameLog, magicItems } from "./records.ts";

/** Every owner-only control on the character page, whether or not the layout shows it. */
function ownerControls(page: Page, characterId: string) {
	return {
		edit: page.locator(`a[href="/characters/${characterId}/edit"]`),
		deleteCharacter: page.locator('[aria-label="Delete Character"]'),
		deleteLog: page.locator('[aria-label="Delete Log"]'),
		newLog: page.locator('[aria-label="New Log"]'),
		logLinks: page.locator(`a[href^="/characters/${characterId}/log/"]`),
		dmLinks: page.locator('a[href^="/dms/"]')
	};
}

async function expectReadOnly(page: Page, characterId: string) {
	for (const [name, control] of Object.entries(ownerControls(page, characterId))) {
		await expect(control, `${name} should not render for someone else`).toHaveCount(0);
	}
}

test("shared character view: public, read-only, and hidden when the owner is banned", async ({ users }) => {
	const owner = await users.signUp({ label: "sharer" });
	const characterName = `E2E Shared ${owner.handle}`;
	const logTitle = `E2E Shared Session ${owner.handle}`;
	const dmName = `E2E Shared DM ${owner.handle}`;
	const itemName = `Shared Amulet ${owner.handle}`;
	const characterId = await createCharacter(owner.page, { name: characterName });
	await createGameLog(owner.page, characterId, { title: logTitle, dm: dmName, gained: [itemName] });
	const path = `/characters/${characterId}`;

	async function expectPublicDetails(page: Page) {
		await page.goto(path);
		await expect(page.getByRole("heading", { name: characterName })).toBeVisible();
		await expect(page.getByText(logTitle, { exact: true }).filter({ visible: true })).toBeVisible();
		await expect(page.getByText(dmName).filter({ visible: true }).first()).toBeVisible();
		await expect(magicItems(page)).toContainText(itemName);
		await expect(page.getByText("Player:").filter({ visible: true }).locator("xpath=..")).toContainText(owner.handle);
	}

	await test.step("the owner sees the edit and delete controls", async () => {
		await owner.page.goto(path);
		const controls = ownerControls(owner.page, characterId);
		for (const control of [controls.edit, controls.deleteLog, controls.newLog, controls.logLinks, controls.dmLinks]) {
			await expect(control.first()).toBeAttached();
		}
	});

	await test.step("a logged-out visitor sees the character read-only", async () => {
		const visitor = await users.visitor();
		await expectPublicDetails(visitor.page);
		await expectReadOnly(visitor.page, characterId);
	});

	await test.step("another user sees the character read-only", async () => {
		const other = await users.signUp({ label: "viewer" });
		await expectPublicDetails(other.page);
		await expectReadOnly(other.page, characterId);
	});

	await test.step("a banned owner's character is not found", async () => {
		const visitor = await users.visitor();
		await setBanned(owner.id, true);
		try {
			const response = await visitor.page.goto(path);
			expect(response?.status()).toBe(404);
			await expect(visitor.page.locator("main").getByText("Character not found").first()).toBeVisible();
			await expect(visitor.page.getByRole("heading", { name: characterName })).toHaveCount(0);
		} finally {
			await setBanned(owner.id, false);
		}
	});
});
