import { expect, type Page } from "@playwright/test";
import { keyFromPublicUrl } from "./storage.ts";
import { characterIdFromUrl, logIdFromHref } from "./ui.ts";

export const RECORD_ID = "[0-9a-f-]{36}";

export interface CharacterFields {
	name: string;
	campaign?: string;
	race?: string;
	className?: string;
}

/** Fills the character form without saving. Leaves the "Create Starting Log" option off. */
export async function fillCharacterForm(page: Page, fields: CharacterFields) {
	const starting = page.getByRole("checkbox", { name: "Create Starting Log" });
	if ((await starting.count()) && (await starting.isChecked())) await starting.uncheck();
	await page.getByLabel("Character Name").fill(fields.name);
	await page.getByLabel("Campaign").fill(fields.campaign ?? "E2E Campaign");
	await page.getByLabel("Species").fill(fields.race ?? "Elf");
	await page.getByLabel("Class").fill(fields.className ?? "Fighter");
}

export async function createCharacter(page: Page, fields: CharacterFields) {
	await page.goto("/characters/new/edit");
	await fillCharacterForm(page, fields);
	await page.getByRole("button", { name: "Save Character" }).click();
	await page.waitForURL(new RegExp(`/characters/${RECORD_ID}$`, "iu"));
	const id = characterIdFromUrl(page.url());
	if (!id) throw new Error(`Saving ${fields.name} did not open its character page`);
	return id;
}

export interface GameLogFields {
	title: string;
	/** A named DM. Empty uses the player as DM. */
	dm?: string;
	level?: number;
	gold?: number;
	/** Magic items gained, by name. */
	gained?: string[];
	/** Magic item dropped, by name. */
	dropped?: string;
	type?: "game" | "nongame";
}

/** Opens the new-log form for a character and fills it without saving. */
export async function fillGameLog(page: Page, characterId: string, fields: GameLogFields) {
	await page.goto(`/characters/${characterId}/log/new`);
	if (fields.type === "nongame") await page.getByLabel("Log Type").selectOption("nongame");
	await page.getByLabel("Title").fill(fields.title);
	if (fields.dm) {
		await page.getByLabel("DM Name").fill(fields.dm);
		await page.keyboard.press("Escape");
	}
	if (fields.level !== undefined) await page.getByLabel("Level").fill(String(fields.level));
	if (fields.gold !== undefined) await page.getByLabel("Gold").fill(String(fields.gold));
	for (const [index, name] of (fields.gained ?? []).entries()) {
		await page.getByRole("button", { name: "Add Magic Item" }).first().click();
		await addedItemCards(page).nth(index).getByLabel("Name").fill(name);
	}
	if (fields.dropped) await dropItem(page, fields.dropped);
}

export async function createGameLog(page: Page, characterId: string, fields: GameLogFields) {
	await fillGameLog(page, characterId, fields);
	await saveLog(page);
	await page.waitForURL(new RegExp(`/characters/${characterId}$`));
	return logIdOnCharacterPage(page, fields.title);
}

export async function dropItem(page: Page, name: string) {
	await page.getByRole("button", { name: "Remove Magic Item" }).click();
	await droppedItemCards(page).last().getByLabel("Select an Item").selectOption({ label: name });
}

export interface DmLogFields {
	title: string;
	/** Assigned character, by name. */
	character?: string;
	level?: number;
}

export async function fillDmLog(page: Page, fields: DmLogFields) {
	await page.goto("/dm-logs/new");
	await page.getByLabel("Title").fill(fields.title);
	if (fields.character) await assignCharacter(page, fields.character);
	if (fields.level !== undefined) await page.getByLabel("Level").fill(String(fields.level));
}

export async function createDmLog(page: Page, fields: DmLogFields) {
	await fillDmLog(page, fields);
	await saveLog(page);
	await page.waitForURL(/\/dm-logs$/);
	return dmLogIdOnList(page, fields.title);
}

export async function saveLog(page: Page) {
	await page.getByRole("button", { name: "Save Log" }).click();
}

export async function logIdOnCharacterPage(page: Page, title: string) {
	const href = await page.getByRole("link", { name: title, exact: true }).getAttribute("href");
	const id = logIdFromHref(href);
	if (!id) throw new Error(`No log link named ${title}`);
	return id;
}

export async function dmLogIdOnList(page: Page, title: string) {
	// Mobile and desktop lists both render each link; only one copy is visible.
	const link = page.locator('a[href^="/dm-logs/"]', { hasText: title }).filter({ visible: true });
	const id = logIdFromHref(await link.getAttribute("href"));
	if (!id) throw new Error(`No DM log link named ${title}`);
	return id;
}

export async function dmIdOnCharacterPage(page: Page, dmName: string) {
	const id = (await page.getByRole("link", { name: dmName, exact: true }).getAttribute("href"))?.split("/").pop() ?? "";
	expect(id, `No DM link named ${dmName}`).toMatch(new RegExp(`^${RECORD_ID}$`, "iu"));
	return id;
}

export async function setLogYear(page: Page, year: string) {
	const segment = page.getByRole("spinbutton", { name: "year" });
	await segment.click();
	await segment.pressSequentially(year);
}

export async function assignCharacter(page: Page, name: string) {
	const assigned = page.getByLabel("Assigned Character");
	// Bits UI opens this combobox on keydown, not on a programmatic value change.
	await assigned.fill(name);
	await assigned.press("ArrowDown");
	await page.getByRole("option", { name }).click();
}

export function addedItemCards(page: Page) {
	return page.locator(".card").filter({ has: page.getByRole("heading", { name: "Add Magic Item" }) });
}

export function droppedItemCards(page: Page) {
	return page.locator(".card").filter({ has: page.getByRole("heading", { name: "Drop Magic Item" }) });
}

export function magicItems(page: Page) {
	// The heading sits in a wrapper; the item list is the wrapper's next sibling, not the heading's.
	return page.getByRole("heading", { name: "Magic Items", exact: true }).locator("xpath=../following-sibling::p[1]");
}

/** The alert a remote form shows above itself for a form-level issue. */
export function formAlert(page: Page) {
	return page.locator("form").locator("xpath=preceding-sibling::div[contains(@class, 'alert-error')]");
}

/**
 * The issue shown under a field, by its form name, such as `name` or `n:level`.
 * A keyed remote form (`form.for(key)`) suffixes the id, as in `name/13njay0/save`.
 */
export function fieldIssue(page: Page, fieldName: string) {
	return page.locator(`label.fieldset-label:is([for="${fieldName}"], [for^="${fieldName}/"]) span.bg-error`);
}

/** The toast a command failure shows. */
export function errorToast(page: Page, message: string | RegExp) {
	return page.locator("[data-sonner-toast]").filter({ hasText: message });
}

export function headerAvatar(page: Page) {
	return page.locator("header button img");
}

export function keyFromUrl(imageUrl: string | null) {
	if (!imageUrl) throw new Error("Expected an image URL");
	const key = keyFromPublicUrl(imageUrl);
	if (!key) throw new Error(`Image URL is not in the configured bucket: ${imageUrl}`);
	return key;
}
