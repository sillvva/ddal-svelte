import type { Page } from "@playwright/test";
import { dropBeforeAcquisition } from "../src/lib/item-timeline-messages.ts";
import { characterRow, dmRow, logIdsForCharacter, logRow, magicItemRow, magicItemsGainedIn, userDmId } from "./db.ts";
import { expect, test, type TestUser } from "./fixtures.ts";
import {
	createCharacter,
	createDmLog,
	createGameLog,
	dmIdOnCharacterPage,
	dmLogIdOnList,
	fillCharacterForm,
	fillDmLog,
	fillGameLog,
	saveLog
} from "./records.ts";
import { callCommand, submitTampered } from "./remote.ts";

interface OwnerRecords {
	characterId: string;
	characterName: string;
	logId: string;
	logTitle: string;
	dmId: string;
	dmName: string;
	dmLogId: string;
	dmLogTitle: string;
}

async function ownerRecords(owner: TestUser): Promise<OwnerRecords> {
	const { page, handle } = owner;
	const characterName = `E2E Owned ${handle}`;
	const logTitle = `E2E Owned Session ${handle}`;
	const dmName = `E2E Owned DM ${handle}`;
	const dmLogTitle = `E2E Owned DM Session ${handle}`;
	const characterId = await createCharacter(page, { name: characterName });
	const logId = await createGameLog(page, characterId, { title: logTitle, dm: dmName });
	const dmId = await dmIdOnCharacterPage(page, dmName);
	const dmLogId = await createDmLog(page, { title: dmLogTitle });
	return { characterId, characterName, logId, logTitle, dmId, dmName, dmLogId, dmLogTitle };
}

/** The error boundary prefixes the message with the error name, as in `LogNotFoundError: Log not found`. */
async function expectNotFound(page: Page, path: string, message: string) {
	await page.goto(path);
	await expect(page.locator("main").getByText(message).first()).toBeVisible();
}

test("another user can't edit or delete your character", async ({ users }) => {
	const owner = await users.signUp({ label: "owner" });
	const intruder = await users.signUp({ label: "intruder" });
	const { characterId, characterName } = await ownerRecords(owner);
	const unchanged = { name: characterName, userId: owner.id };

	await test.step("the edit page is not found", async () => {
		await expectNotFound(intruder.page, `/characters/${characterId}/edit`, "Character not found");
		await expect(intruder.page.getByRole("button", { name: "Save Character" })).toHaveCount(0);
	});

	await test.step("a save aimed at the character is rejected", async () => {
		const { page } = intruder;
		await page.goto("/characters/new/edit");
		await fillCharacterForm(page, { name: `E2E Hijack ${intruder.handle}` });
		const response = await submitTampered(
			page,
			"save",
			(fields) => {
				fields.id = characterId;
			},
			() => page.getByRole("button", { name: "Save Character" }).click()
		);
		expect(response.body).toContain("Character not found");
		expect(await characterRow(characterId)).toMatchObject(unchanged);
	});

	await test.step("a delete aimed at the character is rejected", async () => {
		const result = await callCommand(intruder.page, "src/lib/remote/characters/actions.remote.ts", "deleteCharacter", characterId);
		expect(result.ok).toBe(false);
		expect(await characterRow(characterId)).toMatchObject(unchanged);
	});
});

test("another user can't open, edit, or delete your logs, DMs, or DM logs", async ({ users }) => {
	const owner = await users.signUp({ label: "owner" });
	const intruder = await users.signUp({ label: "intruder" });
	const records = await ownerRecords(owner);
	const { page } = intruder;
	const intruderCharacterId = await createCharacter(page, { name: `E2E Intruder ${intruder.handle}` });

	await test.step("the owner's log, DM log, and DM pages are not found", async () => {
		await expectNotFound(page, `/characters/${records.characterId}/log/${records.logId}`, "Log not found");
		await expect(page.getByRole("button", { name: "Save Log" })).toHaveCount(0);
		await expectNotFound(page, `/dm-logs/${records.dmLogId}`, "Log not found");
		await expect(page.getByRole("button", { name: "Save Log" })).toHaveCount(0);
		await expectNotFound(page, `/dms/${records.dmId}`, "DM not found");
		await expect(page.getByRole("button", { name: "Save DM" })).toHaveCount(0);
	});

	await test.step("a character log save aimed at the owner's log is rejected", async () => {
		await fillGameLog(page, intruderCharacterId, { title: `E2E Hijack ${intruder.handle}` });
		const response = await submitTampered(
			page,
			"saveCharacter",
			(fields) => {
				fields.id = records.logId;
			},
			() => saveLog(page)
		);
		expect(response.body).toContain("Could not save log");
		expect(await logRow(records.logId)).toMatchObject({ name: records.logTitle, characterId: records.characterId });
	});

	await test.step("a log save aimed at the owner's DM is rejected", async () => {
		const before = await logIdsForCharacter(intruderCharacterId);
		await fillGameLog(page, intruderCharacterId, { title: `E2E Hijack Log DM ${intruder.handle}` });
		const response = await submitTampered(
			page,
			"saveCharacter",
			(fields) => {
				fields.dm = { id: records.dmId, name: `E2E Hijacked DM ${intruder.handle}`, DCI: "", userId: intruder.id, isUser: false };
			},
			() => saveLog(page)
		);
		expect(response.body).toContain("Could not save Dungeon Master");
		expect(await dmRow(records.dmId)).toMatchObject({ name: records.dmName, userId: owner.id });
		expect(await logIdsForCharacter(intruderCharacterId)).toEqual(before);
	});

	await test.step("a new log cannot be added to the owner's character", async () => {
		const before = await logIdsForCharacter(records.characterId);
		await fillGameLog(page, intruderCharacterId, { title: `E2E Planted ${intruder.handle}` });
		const response = await submitTampered(
			page,
			"saveCharacter",
			(fields) => {
				fields.characterId = records.characterId;
			},
			() => saveLog(page)
		);
		expect(response.body).toContain("Character not found");
		expect(await logIdsForCharacter(records.characterId)).toEqual(before);
	});

	await test.step("a DM log save aimed at the owner's DM log is rejected", async () => {
		await fillDmLog(page, { title: `E2E Hijack DM ${intruder.handle}` });
		const response = await submitTampered(
			page,
			"saveDM",
			(fields) => {
				fields.id = records.dmLogId;
			},
			() => saveLog(page)
		);
		expect(response.body).toContain("Could not save log");
		expect(await logRow(records.dmLogId)).toMatchObject({ name: records.dmLogTitle, isDmLog: true });
	});

	await test.step("a DM save aimed at the owner's DM is rejected", async () => {
		await page.goto("/dms");
		const ownDmId = await userDmId(intruder.id);
		await page.goto(`/dms/${ownDmId}`);
		const response = await submitTampered(
			page,
			"save",
			(fields) => {
				fields.id = records.dmId;
			},
			() => page.getByRole("button", { name: "Save DM" }).click()
		);
		expect(response.body).toContain("DM not found");
		expect(await dmRow(records.dmId)).toMatchObject({ name: records.dmName, userId: owner.id });
	});

	await test.step("deletes aimed at the owner's records are rejected", async () => {
		for (const id of [records.logId, records.dmLogId]) {
			const result = await callCommand(page, "src/lib/remote/logs/actions.remote.ts", "deleteLog", id);
			expect(result.ok, `deleteLog(${id})`).toBe(false);
			expect(await logRow(id)).not.toBeNull();
		}
		const result = await callCommand(page, "src/lib/remote/dms/actions.remote.ts", "deleteDM", records.dmId);
		expect(result.ok).toBe(false);
		expect(await dmRow(records.dmId)).not.toBeNull();
	});
});

test("another user can't claim or drop your items", async ({ users }) => {
	const owner = await users.signUp({ label: "owner" });
	const intruder = await users.signUp({ label: "intruder" });
	const itemName = `Ring of E2E ${owner.handle}`;
	const ownerCharacterId = await createCharacter(owner.page, { name: `E2E Item Owner ${owner.handle}` });
	const gainLogId = await createGameLog(owner.page, ownerCharacterId, {
		title: `E2E Ring Gain ${owner.handle}`,
		gained: [itemName]
	});
	const [item] = await magicItemsGainedIn(gainLogId);
	if (!item) throw new Error("The gain log did not store its magic item");
	const unchanged = { name: itemName, logGainedId: gainLogId, logLostId: null };
	const { page } = intruder;
	const intruderCharacterId = await createCharacter(page, { name: `E2E Item Intruder ${intruder.handle}` });

	await test.step("a log can't claim and rename the owner's item", async () => {
		await fillGameLog(page, intruderCharacterId, { title: `E2E Item Claim ${intruder.handle}` });
		const response = await submitTampered(
			page,
			"saveCharacter",
			(fields) => {
				fields.magicItemsGained = [{ id: item.id, name: `E2E Stolen ${intruder.handle}`, description: "" }];
			},
			() => saveLog(page)
		);
		expect(response.body).toContain("Could not save items");
		expect(await magicItemRow(item.id)).toMatchObject(unchanged);
		expect(await logIdsForCharacter(intruderCharacterId)).toEqual([]);
	});

	await test.step("a character log can't drop the owner's item", async () => {
		await fillGameLog(page, intruderCharacterId, { title: `E2E Item Drop ${intruder.handle}` });
		const response = await submitTampered(
			page,
			"saveCharacter",
			(fields) => {
				fields.magicItemsLost = [item.id];
			},
			() => saveLog(page)
		);
		expect(response.body).toContain(dropBeforeAcquisition);
		expect(await magicItemRow(item.id)).toMatchObject(unchanged);
	});

	await test.step("an unassigned DM log can't drop the owner's item", async () => {
		const title = `E2E Item Drop DM ${intruder.handle}`;
		await fillDmLog(page, { title });
		await submitTampered(
			page,
			"saveDM",
			(fields) => {
				fields.magicItemsLost = [item.id];
			},
			() => saveLog(page)
		);
		// The DM log saves without the drop, since it has no character inventory.
		await page.waitForURL(/\/dm-logs$/);
		await dmLogIdOnList(page, title);
		expect(await magicItemRow(item.id)).toMatchObject(unchanged);
	});
});
