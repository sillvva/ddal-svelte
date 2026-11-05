import type { ConsoleMessage, Locator, Page } from "@playwright/test";
import {
	cronJob,
	deleteExpiredLogDrafts,
	dmsForUser,
	expireLogDraft,
	insertDm,
	logDraftRow,
	logIdsForCharacter,
	logRow,
	magicItemsGainedIn
} from "./db.ts";
import { expect, test } from "./fixtures.ts";
import {
	addedItemCards,
	createCharacter,
	createDmLog,
	createGameLog,
	errorToast,
	logIdOnCharacterPage,
	RECORD_ID,
	saveLog
} from "./records.ts";
import { callCommand, submitTampered } from "./remote.ts";
import { notesField, pasteFile, pngFile, waitForNoteImages } from "./ui.ts";

const STORAGE_KEY = "ddal.log-draft";
const DRAFT_PATH = new RegExp(`/drafts/(${RECORD_ID})$`, "iu");

function draftIdFromUrl(url: string) {
	const id = new URL(url).pathname.match(DRAFT_PATH)?.[1];
	if (!id) throw new Error(`Not a saved draft URL: ${url}`);
	return id;
}

function storedDraftId(page: Page) {
	return page.evaluate((key) => {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		return typeof parsed === "object" && parsed && "id" in parsed ? String(parsed.id) : null;
	}, STORAGE_KEY);
}

function successToast(page: Page, message: string) {
	return page.locator("[data-sonner-toast]").filter({ hasText: message });
}

/**
 * SSR can't see the browser copy of a draft, so markup that depends on it must still hydrate cleanly.
 * `ready` is something that only renders once the stored draft is read.
 */
async function expectCleanHydration(page: Page, path: string, ready: () => Locator) {
	const errors: string[] = [];
	const onConsole = (message: ConsoleMessage) => {
		if (/hydrat/i.test(message.text())) errors.push(message.text());
	};
	page.on("console", onConsole);
	try {
		await page.goto(path);
		await expect(ready()).toBeVisible();
	} finally {
		page.off("console", onConsole);
	}
	expect(errors, `${path} failed to hydrate`).toEqual([]);
}

/** The header split button. Empty lists repeat it, and the narrow layout's copy is hidden. */
function newLogMenu(page: Page) {
	return page.getByRole("button", { name: "More new log options" }).first();
}

/** Copies the open log as a draft and returns the new draft's id. */
async function copyOpenLog(page: Page) {
	await page.getByRole("button", { name: "Copy as draft" }).click();
	const dialog = page.getByRole("dialog", { name: "Draft created" });
	await expect(dialog).toBeVisible();
	const href = (await dialog.getByRole("link", { name: "Edit draft" }).getAttribute("href")) ?? "";
	const id = href.replace(/^\/drafts\//u, "");
	expect(id).toMatch(new RegExp(`^${RECORD_ID}$`, "iu"));
	return { dialog, id };
}

test("log drafts: a DM log draft only fills a new DM log, and a character log draft only fills a character log", async ({
	users
}) => {
	const { page, handle } = await users.signUp({ label: "draftkind" });
	const characterId = await createCharacter(page, { name: `E2E Kind Hero ${handle}` });
	const characterLogTitle = `E2E Kind Character Log ${handle}`;
	const dmLogTitle = `E2E Kind DM Log ${handle}`;
	await createGameLog(page, characterId, { title: characterLogTitle });
	const dmLogId = await createDmLog(page, { title: dmLogTitle, level: 1 });
	const populate = () => page.getByRole("button", { name: "Populate from draft" });

	await test.step("copying a DM log makes a DM draft", async () => {
		await page.goto(`/dm-logs/${dmLogId}`);
		const { dialog, id } = await copyOpenLog(page);
		await expect(dialog.getByText("Open DM Logs")).toBeVisible();
		const row = await logDraftRow(id);
		expect(row?.data.kind).toBe("dm");
		expect(row?.data).not.toHaveProperty("dm");
		expect(row?.data).not.toHaveProperty("date");
		expect(await storedDraftId(page)).toBe(id);
		await dialog.getByRole("button", { name: "Close" }).first().click();
	});

	await test.step("a DM draft fills a new DM log from the DM Logs menu", async () => {
		await expectCleanHydration(page, "/dm-logs", () => newLogMenu(page));
		await newLogMenu(page).click();
		await page.getByRole("link", { name: "New Log from Draft" }).click();
		await page.waitForURL(/\/dm-logs\/new\?.*fromDraft=1/);
		await expect(page.getByLabel("Title")).toHaveValue(dmLogTitle);
		await expect(page.getByLabel("Level")).toHaveValue("1");
	});

	await test.step("a DM draft is not offered on a character log", async () => {
		await page.goto(`/characters/${characterId}`);
		await expect(page.getByRole("link", { name: "New Log" })).toBeVisible();
		await expect(newLogMenu(page)).toHaveCount(0);

		await page.goto(`/characters/${characterId}/log/new`);
		await expect(page.getByRole("button", { name: "Save Log" })).toBeVisible();
		await expect(populate()).toHaveCount(0);
	});

	await test.step("copying a character log makes a character draft that replaces the DM draft", async () => {
		const [logId] = await logIdsForCharacter(characterId);
		await page.goto(`/characters/${characterId}/log/${logId}`);
		const { dialog, id } = await copyOpenLog(page);
		await expect(dialog.getByText("Open a character")).toBeVisible();
		expect((await logDraftRow(id))?.data.kind).toBe("character");
		expect(await storedDraftId(page)).toBe(id);
		await dialog.getByRole("button", { name: "Close" }).first().click();

		await expectCleanHydration(page, `/characters/${characterId}/log/new`, populate);
		await populate().click();
		await expect(page.getByLabel("Title")).toHaveValue(characterLogTitle);
	});

	await test.step("a character draft is not offered on a DM log", async () => {
		await page.goto("/dm-logs/new");
		await expect(page.getByRole("button", { name: "Save Log" })).toBeVisible();
		await expect(populate()).toHaveCount(0);

		await page.goto("/dm-logs");
		await newLogMenu(page).click();
		await expect(page.getByRole("link", { name: "New Player Draft" })).toBeVisible();
		await expect(page.getByRole("link", { name: "New Log from Draft" })).toHaveCount(0);
	});
});

test("log drafts: the Drafts page lists live drafts with the quota and expiry reminder", async ({ users }) => {
	const { page, handle } = await users.signUp({ label: "draftlist" });
	const firstTitle = `E2E Listed Draft ${handle}`;
	const secondTitle = `E2E Expiring Draft ${handle}`;
	const draftLink = (title: string) => page.locator('a[href^="/drafts/"]', { hasText: title });

	async function saveDraft(title: string) {
		await page.goto("/drafts");
		await page.getByRole("link", { name: "New Player Draft" }).click();
		await page.waitForURL(/\/drafts\/new$/);
		await page.getByLabel("Title").fill(title);
		await page.getByRole("button", { name: "Save Draft" }).click();
		await page.waitForURL(DRAFT_PATH);
		return draftIdFromUrl(page.url());
	}

	await test.step("the menu links to an empty Drafts page", async () => {
		await page.goto("/characters");
		await page.getByRole("link", { name: "Drafts", exact: true }).filter({ visible: true }).first().click();
		await page.waitForURL(/\/drafts$/);
		await expect(page.getByText("You have no drafts.")).toBeVisible();
		await expect(page.getByText("0 / 50")).toBeVisible();
		await page.getByText("How long does a draft last?").click();
		await expect(page.getByText("14 days after you last saved it.")).toBeVisible();
	});

	const [firstId, secondId] = await test.step("saved drafts are listed, newest first, with the quota", async () => {
		const ids = [await saveDraft(firstTitle), await saveDraft(secondTitle)] as const;
		await page.goto("/drafts");
		await expect(page.getByText("2 / 50")).toBeVisible();
		await expect(draftLink(firstTitle)).toHaveAttribute("href", `/drafts/${ids[0]}`);
		await expect(page.locator("tbody a.row-link")).toHaveText([secondTitle, firstTitle]);
		await expect(page.getByText("Player Log").first()).toBeVisible();
		return ids;
	});

	await test.step("deleting from the list removes the draft", async () => {
		await page
			.getByRole("row")
			.filter({ has: draftLink(firstTitle) })
			.getByRole("button", { name: "Delete Draft" })
			.click();
		await expect(successToast(page, `${firstTitle} deleted`)).toBeVisible();
		await expect(draftLink(firstTitle)).toHaveCount(0);
		await expect(page.getByText("1 / 50")).toBeVisible();
		expect(await logDraftRow(firstId)).toBeNull();
	});

	await test.step("expired drafts drop off the list and the quota", async () => {
		await expireLogDraft(secondId);
		await page.goto("/drafts");
		await expect(draftLink(secondTitle)).toHaveCount(0);
		await expect(page.getByText("You have no drafts.")).toBeVisible();
		await expect(page.getByText("0 / 50")).toBeVisible();
	});
});

test("log drafts: share as a DM, open the link, fill a log, and keep edits with the owner", async ({ users }) => {
	const dm = await users.signUp({ label: "draftdm" });
	const player = await users.signUp({ label: "draftplayer" });
	const newcomer = await users.signUp({ label: "draftnew" });

	const draftTitle = `E2E Draft ${dm.handle}`;
	const draftDmName = `E2E Draft DM ${dm.handle}`;
	const draftDci = "7310042001";
	const itemName = `E2E Draft Sword ${dm.handle}`;
	const playerDmName = `E2E Known DM ${player.handle}`;
	let draftId = "";

	await test.step("a DM starts a player draft from the New Log menu", async () => {
		const { page } = dm;
		await page.goto("/dm-logs");
		await newLogMenu(page).click();
		await page.getByRole("link", { name: "New Player Draft" }).click();
		await page.waitForURL(/\/drafts\/new$/);
		await expect(page.getByLabel("DM Name")).not.toHaveValue("");
		await expect(page.getByLabel("Assigned Character")).toHaveCount(0);
	});

	await test.step("the draft form refuses images", async () => {
		const { page } = dm;
		await pasteFile(notesField(page), pngFile("map.png"));
		await expect(errorToast(page, "Images can't be uploaded to a log draft.")).toBeVisible();
		await expect(notesField(page)).toHaveValue("");

		const prepared = await callCommand(page, "src/lib/remote/images/actions.remote.ts", "prepareNoteImage", {
			contentType: "image/webp",
			bytes: 100
		});
		expect(prepared).toMatchObject({
			ok: false,
			error: { message: expect.stringContaining("Images can't be uploaded to a log draft.") }
		});
	});

	await test.step("save the draft and share it", async () => {
		const { page } = dm;
		await page.getByLabel("Title").fill(draftTitle);
		await page.getByLabel("DM Name").fill(draftDmName);
		await page.getByLabel("DM DCI").fill(draftDci);
		await page.getByLabel("Level").fill("1");
		await page.getByLabel("Gold").fill("150");
		await notesField(page).fill("Recovered the idol.");
		await page.getByRole("button", { name: "Add Magic Item" }).first().click();
		await addedItemCards(page).first().getByLabel("Name").fill(itemName);
		await page.getByRole("button", { name: "Save Draft" }).click();
		await page.waitForURL(DRAFT_PATH);
		draftId = draftIdFromUrl(page.url());

		const row = await logDraftRow(draftId);
		expect(row).toMatchObject({
			userId: dm.id,
			data: {
				kind: "character",
				name: draftTitle,
				dm: { name: draftDmName, DCI: draftDci },
				description: "Recovered the idol."
			}
		});
		expect(row?.data.magicItemsGained.map((item) => item.name)).toEqual([itemName]);

		await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
		await page.getByRole("button", { name: "Show QR code" }).click();
		const qr = page.getByRole("dialog", { name: "Scan to open this draft" });
		await expect(qr.getByRole("img", { name: "QR code" })).toBeVisible();
		await expect(qr.getByText(new RegExp(`/draft/${draftId}$`))).toBeVisible();
		await qr.getByRole("button", { name: "Close" }).first().click();
		await expect(qr).toHaveCount(0);
	});

	await test.step("editing keeps the same link", async () => {
		const { page } = dm;
		await page.getByLabel("Gold").fill("200");
		await page.getByRole("button", { name: "Save Draft" }).click();
		await expect(successToast(page, "Draft saved")).toBeVisible();
		expect(new URL(page.url()).pathname).toBe(`/drafts/${draftId}`);
		await expect.poll(async () => (await logDraftRow(draftId))?.data).toMatchObject({ gold: 200 });
	});

	let characterId = "";
	let knownDmId = "";

	await test.step("a player opens the link and the draft is kept in the browser", async () => {
		const { page } = player;
		characterId = await createCharacter(page, { name: `E2E Draft Hero ${player.handle}` });
		await createGameLog(page, characterId, { title: `E2E First Session ${player.handle}` });
		// Same DCI, different name: the DCI decides the match.
		knownDmId = await insertDm(player.id, playerDmName, draftDci);

		await page.goto(`/draft/${draftId}`);
		await expect(page.getByRole("heading", { name: draftTitle })).toBeVisible();
		await expect(successToast(page, "A log draft is available")).toBeVisible();
		await expect(page.getByRole("link", { name: "Edit draft" })).toHaveCount(0);
		expect(await storedDraftId(page)).toBe(draftId);
	});

	await test.step("only the owner can edit or delete the draft", async () => {
		const { page } = player;
		await page.goto(`/drafts/${draftId}`);
		await expect(page.getByText("Draft not found")).toBeVisible();

		const removed = await callCommand(page, "src/lib/remote/drafts/actions.remote.ts", "remove", draftId);
		expect(removed).toMatchObject({ ok: false, error: { status: 404 } });

		await page.goto("/drafts/new");
		await page.getByLabel("Title").fill("Hijacked");
		const response = await submitTampered(
			page,
			"save",
			(fields) => {
				fields.id = draftId;
			},
			() => page.getByRole("button", { name: "Save Draft" }).click()
		);
		expect(response.body).toContain("Draft not found");
		expect((await logDraftRow(draftId))?.data.name).toBe(draftTitle);
	});

	await test.step("New Log from Draft fills the form without saving it", async () => {
		const { page } = player;
		await expectCleanHydration(page, `/characters/${characterId}`, () => newLogMenu(page));
		await newLogMenu(page).click();
		await page.getByRole("link", { name: "New Log from Draft" }).click();
		await page.waitForURL(new RegExp(`/characters/${characterId}/log/new\\?.*fromDraft=1`));

		await expect(page.getByLabel("Title")).toHaveValue(draftTitle);
		await expect(page.getByLabel("DM Name")).toHaveValue(playerDmName);
		await expect(page.getByLabel("DM DCI")).toHaveValue(draftDci);
		await expect(page.getByLabel("Gold")).toHaveValue("200");
		await expect(addedItemCards(page).first().getByLabel("Name")).toHaveValue(itemName);
		await expect(notesField(page)).toHaveValue("Recovered the idol.");
		expect(await logIdsForCharacter(characterId)).toHaveLength(1);
	});

	await test.step("a log filled from a draft can still take images, and saves to the matched DM", async () => {
		const { page } = player;
		await pasteFile(notesField(page), pngFile("idol.png"));
		await waitForNoteImages(page, 1);
		await saveLog(page);
		await page.waitForURL(new RegExp(`/characters/${characterId}$`));

		const logId = await logIdOnCharacterPage(page, draftTitle);
		expect((await logRow(logId))?.dungeonMasterId).toBe(knownDmId);
		const items = await magicItemsGainedIn(logId);
		expect(items.map((item) => item.name)).toEqual([itemName]);
		const draftItemId = (await logDraftRow(draftId))?.data.magicItemsGained[0]?.id;
		expect(items[0]?.id).not.toBe(draftItemId);
		expect((await dmsForUser(player.id)).filter((row) => row.DCI === draftDci)).toHaveLength(1);
	});

	await test.step("a player without a matching DM gets a new DM record of their own", async () => {
		const { page } = newcomer;
		const newcomerCharacter = await createCharacter(page, { name: `E2E Draft Newcomer ${newcomer.handle}` });
		await page.goto(`/draft/${draftId}`);
		await expect(successToast(page, "A log draft is available")).toBeVisible();

		const populate = () => page.getByRole("button", { name: "Populate from draft" });
		await expectCleanHydration(page, `/characters/${newcomerCharacter}/log/new`, populate);
		await populate().click();
		await expect(page.getByLabel("Title")).toHaveValue(draftTitle);
		await expect(page.getByLabel("DM Name")).toHaveValue(draftDmName);
		await saveLog(page);
		await page.waitForURL(new RegExp(`/characters/${newcomerCharacter}$`));

		const created = (await dmsForUser(newcomer.id)).filter((row) => !row.isUser);
		expect(created).toMatchObject([{ name: draftDmName, DCI: draftDci, userId: newcomer.id, isUser: false }]);
		const logId = await logIdOnCharacterPage(page, draftTitle);
		expect((await logRow(logId))?.dungeonMasterId).toBe(created[0]?.id);
	});

	let copiedId = "";

	await test.step("copy an existing log as a draft", async () => {
		const { page } = player;
		const [, logId] = await logIdsForCharacter(characterId);
		await page.goto(`/characters/${characterId}/log/${logId}`);
		await page.getByRole("button", { name: "Copy as draft" }).click();
		const dialog = page.getByRole("dialog", { name: "Draft created" });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole("button", { name: "Show QR code" })).toBeVisible();
		const href = (await dialog.getByRole("link", { name: "Edit draft" }).getAttribute("href")) ?? "";
		copiedId = href.replace(/^\/drafts\//u, "");
		expect(copiedId).toMatch(new RegExp(`^${RECORD_ID}$`, "iu"));

		const row = await logDraftRow(copiedId);
		expect(row).toMatchObject({ userId: player.id, data: { name: draftTitle } });
		expect(row?.data).not.toHaveProperty("date");
		expect(row?.data.description).toMatch(/!\[idol\]\(http/u);
		expect(await storedDraftId(page)).toBe(copiedId);

		await dialog.getByRole("button", { name: "Close" }).first().click();
		await page.goto(`/characters/${characterId}`);
		await expect(newLogMenu(page)).toBeVisible();
	});

	await test.step("an expired draft is gone, and the browser copy goes with it", async () => {
		const { page } = player;
		await expireLogDraft(copiedId);
		await page.goto(`/draft/${copiedId}`);
		await expect(page.getByText("Draft not found")).toBeVisible();
		await expect.poll(() => storedDraftId(page)).toBeNull();

		await page.goto(`/characters/${characterId}`);
		await expect(page.getByRole("link", { name: "New Log" })).toBeVisible();
		await expect(newLogMenu(page)).toHaveCount(0);
	});

	await test.step("the daily database job deletes expired drafts and keeps live ones", async () => {
		expect(await cronJob("delete-expired-log-drafts")).toEqual([
			{ schedule: "0 4 * * *", command: "select public.delete_expired_log_drafts()", active: true }
		]);
		// Reads only hide an expired draft. Deleting it is the job's work.
		expect(await logDraftRow(copiedId)).not.toBeNull();
		expect(await deleteExpiredLogDrafts()).toBeGreaterThanOrEqual(1);
		expect(await logDraftRow(copiedId)).toBeNull();
		expect(await logDraftRow(draftId)).not.toBeNull();
	});
});
