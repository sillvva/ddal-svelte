import { characterRow, logRow } from "./db.ts";
import { expect, test } from "./fixtures.ts";
import { createCharacter, fieldIssue, fillCharacterForm, fillGameLog, logIdOnCharacterPage, saveLog } from "./records.ts";
import { submitTampered } from "./remote.ts";

/** One grapheme, eleven UTF-16 code units. Titles need a letter, so each limit test starts with "A". */
const FAMILY = "👨‍👩‍👧‍👦";
const graphemes64 = `A${FAMILY.repeat(63)}`;
const graphemes65 = `A${FAMILY.repeat(64)}`;

test("character form: grapheme limit and required fields", async ({ users }) => {
	const { page } = await users.signUp({ label: "validation" });
	const saveCharacter = page.getByRole("button", { name: "Save Character" });
	let characterId = "";

	await test.step("a 65-grapheme name is rejected", async () => {
		await page.goto("/characters/new/edit");
		await fillCharacterForm(page, { name: graphemes65 });
		await saveCharacter.click();
		await expect(fieldIssue(page, "name")).toContainText(/graphemes/i);
		await expect(page).toHaveURL(/\/characters\/new\/edit/);
	});

	await test.step("a 64-grapheme name saves", async () => {
		await page.getByLabel("Character Name").fill(graphemes64);
		await saveCharacter.click();
		await page.waitForURL(/\/characters\/[0-9a-f-]{36}$/iu);
		characterId = new URL(page.url()).pathname.split("/").pop() ?? "";
		expect(await characterRow(characterId)).toMatchObject({ name: graphemes64 });
		await expect(page.getByRole("heading", { name: graphemes64 })).toBeVisible();
	});

	await test.step("blank required fields are rejected", async () => {
		await page.goto(`/characters/${characterId}/edit`);
		await page.getByLabel("Species").fill("   ");
		await page.getByLabel("Class").fill("🎲");
		await saveCharacter.click();
		await expect(fieldIssue(page, "race")).toHaveText("Required");
		await expect(fieldIssue(page, "class")).toHaveText("Required");
		await expect(page).toHaveURL(new RegExp(`/characters/${characterId}/edit$`));
	});

	await test.step("the server rejects a 65-grapheme name", async () => {
		await page.goto(`/characters/${characterId}/edit`);
		const response = await submitTampered(
			page,
			"save",
			(fields) => {
				fields.name = graphemes65;
			},
			() => saveCharacter.click()
		);
		expect(response.body).toMatch(/graphemes/i);
		expect(await characterRow(characterId)).toMatchObject({ name: graphemes64 });
	});

	await test.step("the server rejects a blank name", async () => {
		const response = await submitTampered(
			page,
			"save",
			(fields) => {
				fields.name = "   ";
			},
			() => saveCharacter.click()
		);
		expect(response.body).toContain("Required");
		expect(await characterRow(characterId)).toMatchObject({ name: graphemes64 });
	});
});

test("log form: level cap, required title, and grapheme limit", async ({ users }) => {
	const { page, handle } = await users.signUp({ label: "validation" });
	const characterId = await createCharacter(page, { name: `E2E Validation ${handle}` });
	const newLogUrl = new RegExp(`/characters/${characterId}/log/new`);

	await test.step("a level that takes the character past 20 is rejected", async () => {
		await fillGameLog(page, characterId, { title: `E2E Too Far ${handle}`, level: 20 });
		await saveLog(page);
		await expect(fieldIssue(page, "n:level")).toContainText("Cannot increase level above 20");
		await expect(page).toHaveURL(newLogUrl);
	});

	await test.step("a level that reaches exactly 20 saves", async () => {
		const title = `E2E Capstone ${handle}`;
		await fillGameLog(page, characterId, { title, level: 19 });
		await saveLog(page);
		await page.waitForURL(new RegExp(`/characters/${characterId}$`));
		expect(await logRow(await logIdOnCharacterPage(page, title))).toMatchObject({ level: 19 });
	});

	await test.step("any further level is rejected", async () => {
		await fillGameLog(page, characterId, { title: `E2E Epic ${handle}`, level: 1 });
		await saveLog(page);
		await expect(fieldIssue(page, "n:level")).toContainText("Cannot increase level above 20");
		await expect(page).toHaveURL(newLogUrl);
	});

	await test.step("a blank title is rejected", async () => {
		await fillGameLog(page, characterId, { title: "   " });
		await saveLog(page);
		await expect(fieldIssue(page, "name")).toHaveText("Required");
		await expect(page).toHaveURL(newLogUrl);
	});

	await test.step("a 65-grapheme title is rejected, and 64 saves", async () => {
		await fillGameLog(page, characterId, { title: graphemes65 });
		await saveLog(page);
		await expect(fieldIssue(page, "name")).toContainText(/graphemes/i);
		await expect(page).toHaveURL(newLogUrl);

		await page.getByLabel("Title").fill(graphemes64);
		await saveLog(page);
		await page.waitForURL(new RegExp(`/characters/${characterId}$`));
		expect(await logRow(await logIdOnCharacterPage(page, graphemes64))).toMatchObject({ name: graphemes64 });
	});

	await test.step("the server rejects a 65-grapheme title", async () => {
		await fillGameLog(page, characterId, { title: `E2E Tampered ${handle}` });
		const response = await submitTampered(
			page,
			"saveCharacter",
			(fields) => {
				fields.name = graphemes65;
			},
			() => saveLog(page)
		);
		expect(response.body).toMatch(/graphemes/i);
		await expect(page).toHaveURL(newLogUrl);
	});
});
