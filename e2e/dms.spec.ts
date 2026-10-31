import { dmRow, logRow, userDmId } from "./db.ts";
import { expect, test } from "./fixtures.ts";
import { assignCharacter, createCharacter, createGameLog, dmIdOnCharacterPage, dmLogIdOnList } from "./records.ts";
import { callCommand } from "./remote.ts";

test("DMs and DM logs: assign, edit, delete, and unassign", async ({ users }) => {
	const user = await users.signUp({ label: "dms" });
	const { page, handle } = user;
	const characterName = `E2E DMs ${handle}`;
	const dmName = `E2E Guest ${handle}`;
	const editedDmName = `${dmName} Edited`;
	const gainTitle = `E2E Session ${handle}`;
	const dmLogTitle = `E2E DM Session ${handle}`;
	const secondDmLogTitle = `E2E DM Session Two ${handle}`;
	const characterId = await createCharacter(page, { name: characterName });
	await createGameLog(page, characterId, { title: gainTitle, dm: dmName });
	const dmId = await dmIdOnCharacterPage(page, dmName);
	const dmLogIds: string[] = [];

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

		dmLogIds.push(await dmLogIdOnList(page, dmLogTitle), await dmLogIdOnList(page, secondDmLogTitle));
		expect(new Set(dmLogIds).size).toBe(2);
		for (const id of dmLogIds) expect((await logRow(id))?.characterId).toBe(characterId);
	});

	await test.step("edit the DM", async () => {
		await page.goto(`/dms/${dmId}`);
		await page.getByLabel("DM Name").fill(editedDmName);
		await page.getByLabel("DCI").fill("424242");
		await page.getByRole("button", { name: "Save DM" }).click();
		await page.waitForURL(/\/dms$/);
		await expect(page.locator(`a[href="/dms/${dmId}"]`, { hasText: editedDmName })).toBeVisible();
		await expect(page.getByRole("cell", { name: "424242" })).toBeVisible();
	});

	await test.step("a DM with logs cannot be deleted", async () => {
		await page.goto(`/dms/${dmId}`);
		await expect(page.getByRole("button", { name: "Delete DM" })).toHaveCount(0);
		const result = await callCommand(page, "src/lib/remote/dms/actions.remote.ts", "deleteDM", dmId);
		expect(result).toMatchObject({ ok: false, error: { message: expect.stringContaining("You cannot delete a DM that has logs") } });
		expect(await dmRow(dmId)).not.toBeNull();
	});

	await test.step("your own DM cannot be deleted", async () => {
		const ownDmId = await userDmId(user.id);
		const result = await callCommand(page, "src/lib/remote/dms/actions.remote.ts", "deleteDM", ownDmId);
		expect(result).toMatchObject({ ok: false, error: { message: expect.stringContaining("Unable to delete User DM") } });
		expect(await dmRow(ownDmId)).not.toBeNull();
	});

	await test.step("delete the DM after its log is gone", async () => {
		await page.goto(`/characters/${characterId}`);
		await page.locator("tbody").filter({ hasText: gainTitle }).getByRole("button", { name: "Delete Log" }).click();
		await expect(page.getByRole("link", { name: gainTitle })).toHaveCount(0);

		await page.goto("/dms");
		await page.locator("tr").filter({ hasText: editedDmName }).getByRole("button", { name: "Delete DM" }).click();
		await expect(page.locator(`a[href="/dms/${dmId}"]`)).toHaveCount(0);
	});

	await test.step("deleting the character unassigns its DM logs", async () => {
		await page.goto(`/characters/${characterId}`);
		await page.getByRole("button", { name: "Menu" }).click();
		await page.getByRole("button", { name: "Delete Character" }).click();
		await page.waitForURL(/\/characters$/);
		await expect(page.getByRole("link", { name: characterName })).toHaveCount(0);

		for (const id of dmLogIds) expect(await logRow(id)).toMatchObject({ characterId: null, isDmLog: true });
		await page.goto("/dm-logs");
		await expect(page.locator('a[href^="/dm-logs/"]', { hasText: secondDmLogTitle }).filter({ visible: true })).toBeVisible();
	});

	await test.step("delete a DM log", async () => {
		await page.locator("tbody").filter({ hasText: dmLogTitle }).getByRole("button", { name: "Delete Log" }).click();
		await expect(page.locator('a[href^="/dm-logs/"]', { hasText: dmLogTitle })).toHaveCount(0);
		expect(await logRow(dmLogIds[0] ?? "")).toBeNull();
	});
});
