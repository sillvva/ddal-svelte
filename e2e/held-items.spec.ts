import { logRow, magicItemRow, magicItemsGainedIn } from "./db.ts";
import { expect, test } from "./fixtures.ts";
import { createCharacter, createGameLog, fillGameLog, saveLog, setLogYear } from "./records.ts";
import { submitTampered, type FormFields } from "./remote.ts";

// Must match the messages exported from src/lib/entities.ts.
const dropBeforeAcquisition = "Can't drop an item before it was acquired";
const alreadyDropped = "This item was already dropped in an earlier log";
const gainAfterDrop = "This item was dropped in an earlier log";

const DAY = 86_400_000;

test("the server rejects drops that break the held-item timeline", async ({ users }) => {
	const { page, handle } = await users.signUp({ label: "held" });
	const itemName = `Ring of E2E ${handle}`;
	const characterId = await createCharacter(page, { name: `E2E Held ${handle}` });
	const gainLogId = await createGameLog(page, characterId, { title: `E2E Ring Gain ${handle}`, gained: [itemName] });
	const [item] = await magicItemsGainedIn(gainLogId);
	if (!item) throw new Error("The gain log did not store its magic item");
	let dropLogId = "";

	const dropItem = (fields: FormFields) => {
		fields.magicItemsLost = [item.id];
	};
	const removeButton = page.getByRole("button", { name: "Remove Magic Item" });

	await test.step("a backdated log cannot drop an item acquired later", async () => {
		await fillGameLog(page, characterId, { title: `E2E Backdated Drop ${handle}` });
		await setLogYear(page, "2015");
		await expect(removeButton).toHaveCount(0);
		const response = await submitTampered(page, "saveCharacter", dropItem, () => saveLog(page));
		expect(response.body).toContain(dropBeforeAcquisition);
		expect(await magicItemRow(item.id)).toMatchObject({ logGainedId: gainLogId, logLostId: null });
	});

	await test.step("the item can be dropped once", async () => {
		dropLogId = await createGameLog(page, characterId, { title: `E2E Ring Drop ${handle}`, dropped: itemName });
		expect(await magicItemRow(item.id)).toMatchObject({ logLostId: dropLogId });
	});

	await test.step("the same item cannot be dropped twice", async () => {
		await fillGameLog(page, characterId, { title: `E2E Second Drop ${handle}` });
		await expect(removeButton).toHaveCount(0);
		const response = await submitTampered(page, "saveCharacter", dropItem, () => saveLog(page));
		expect(response.body).toContain(alreadyDropped);
		expect(await magicItemRow(item.id)).toMatchObject({ logLostId: dropLogId });
	});

	await test.step("the drop log cannot move before the item was gained", async () => {
		const before = await logRow(dropLogId);
		await page.goto(`/characters/${characterId}/log/${dropLogId}`);
		const response = await submitTampered(
			page,
			"saveCharacter",
			(fields) => {
				fields.date = new Date(2015, 0, 1).getTime();
				dropItem(fields);
			},
			() => saveLog(page)
		);
		expect(response.body).toContain(dropBeforeAcquisition);
		expect((await logRow(dropLogId))?.date).toEqual(before?.date);
	});

	await test.step("the gain log cannot move after the item was dropped", async () => {
		const before = await logRow(gainLogId);
		await page.goto(`/characters/${characterId}/log/${gainLogId}`);
		const response = await submitTampered(
			page,
			"saveCharacter",
			(fields) => {
				fields.date = Date.now() + DAY;
			},
			() => saveLog(page)
		);
		expect(response.body).toContain(gainAfterDrop);
		expect((await logRow(gainLogId))?.date).toEqual(before?.date);
		expect(await magicItemRow(item.id)).toMatchObject({ logGainedId: gainLogId, logLostId: dropLogId });
	});
});
