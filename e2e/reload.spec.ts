import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures.ts";
import { createCharacter, createDmLog, createGameLog, dmIdOnCharacterPage, RECORD_ID } from "./records.ts";
import { waitForHydration } from "./ui.ts";

interface ReloadMarkers {
	characterName: string;
	secondCharacterName: string;
	dmName: string;
	dmLogTitle: string;
	secondDmLogTitle: string;
	dmId: string;
}

test("every page survives a full reload and hydrates", async ({ users }) => {
	const { page, handle } = await users.signUp({ label: "reload" });
	const characterName = `E2E Reload ${handle}`;
	const markers: ReloadMarkers = {
		characterName,
		secondCharacterName: `E2E Reload Companion ${handle}`,
		dmName: `E2E Guest ${handle}`,
		dmLogTitle: `E2E DM Session ${handle}`,
		secondDmLogTitle: `E2E DM Session Two ${handle}`,
		dmId: ""
	};

	const characterId = await test.step("create characters, logs, and DM logs", async () => {
		const id = await createCharacter(page, { name: characterName });
		await createCharacter(page, { name: markers.secondCharacterName, race: "Dwarf", className: "Cleric" });
		await createGameLog(page, id, { title: `E2E Item Gain ${handle}`, dm: markers.dmName, gained: [`Cloak ${handle}`] });
		markers.dmId = await dmIdOnCharacterPage(page, markers.dmName);
		await createGameLog(page, id, { title: `E2E Purchase ${handle}`, type: "nongame", gold: 25 });
		await createDmLog(page, { title: markers.dmLogTitle, character: characterName });
		await createDmLog(page, { title: markers.secondDmLogTitle });
		return id;
	});

	const paths = await pagesToReload(page, characterId);
	for (const path of paths) {
		await test.step(`reload ${path}`, () => expectFullReload(page, path, markers));
	}
});

/** Every saved record, plus the empty create forms, that this user can open. */
async function pagesToReload(page: Page, characterId: string) {
	await page.goto("/characters");
	const characterIds = idsFromPaths(await anchorPaths(page), new RegExp(`^/characters/(${RECORD_ID})$`, "iu"));
	expect(characterIds, "Character list did not link to the characters created in this run").toContain(characterId);

	const records = new Set<string>();
	for (const id of characterIds) {
		await page.goto(`/characters/${id}`);
		for (const path of await anchorPaths(page)) {
			if (new RegExp(`^/characters/${id}/log/${RECORD_ID}$`, "iu").test(path)) records.add(path);
			if (new RegExp(`^/dm-logs/${RECORD_ID}$`, "iu").test(path)) records.add(path);
		}
	}

	await page.goto("/dm-logs");
	for (const path of await anchorPaths(page)) {
		if (new RegExp(`^/dm-logs/${RECORD_ID}$`, "iu").test(path)) records.add(path);
	}

	await page.goto("/dms");
	const dmIds = idsFromPaths(await anchorPaths(page), new RegExp(`^/dms/(${RECORD_ID})$`, "iu"));
	expect(dmIds, "DM list did not link to a DM").not.toEqual([]);

	return [
		"/characters",
		...characterIds.map((id) => `/characters/${id}`),
		...characterIds.map((id) => `/characters/${id}/edit`),
		"/characters/new/edit",
		...[...records].sort(),
		...characterIds.map((id) => `/characters/${id}/log/new`),
		"/dm-logs",
		"/dm-logs/new",
		"/dms",
		...dmIds.map((id) => `/dms/${id}`)
	];
}

async function anchorPaths(page: Page) {
	const hrefs = await page
		.locator("a[href]")
		.evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href") ?? ""));
	return hrefs.map((href) => href.split(/[?#]/)[0] ?? "").filter((path) => path.startsWith("/"));
}

function idsFromPaths(paths: string[], pattern: RegExp) {
	const ids = new Set<string>();
	for (const path of paths) {
		const id = path.match(pattern)?.[1];
		if (id) ids.add(id);
	}
	return [...ids].sort();
}

/**
 * `goto` is already a full document load. Reloading again is the refresh a user
 * does from the address bar, which re-runs SSR and then hydrates that HTML.
 */
async function expectFullReload(page: Page, path: string, markers: ReloadMarkers) {
	await page.goto(path);
	const failures: string[] = [];
	const onPageError = (error: Error) => failures.push(error.message);
	const onConsole = (message: { type(): string; text(): string }) => {
		const type = message.type();
		if ((type === "error" || type === "warning") && /hydrat/i.test(message.text())) failures.push(message.text());
	};
	page.on("pageerror", onPageError);
	page.on("console", onConsole);
	try {
		const response = await page.reload({ waitUntil: "load" });
		expect(response?.ok(), `${path} reloaded with status ${response?.status() ?? "missing"}`).toBe(true);
		await waitForHydration(page);
		expect(new URL(page.url()).pathname, path).toBe(path);
		await expect(page.getByRole("heading", { name: "Rolled a Natural 1!" })).toHaveCount(0);
		await expect(page.getByRole("heading", { name: "4D4: Not Found!" })).toHaveCount(0);
		await expect(page.getByRole("heading", { name: /^Error( \d+)?!$/ })).toHaveCount(0);
		await expectPageReady(page, path, markers);
		expect(failures, `${path} failed during reload\n${failures.join("\n")}`).toEqual([]);
	} finally {
		page.off("pageerror", onPageError);
		page.off("console", onConsole);
	}
}

async function expectPageReady(page: Page, path: string, markers: ReloadMarkers) {
	if (path === "/characters") {
		await expect(page.getByRole("link", { name: markers.characterName }).filter({ visible: true })).toBeVisible();
		await expect(page.getByRole("link", { name: markers.secondCharacterName }).filter({ visible: true })).toBeVisible();
		return;
	}

	if (new RegExp(`^/characters/${RECORD_ID}$`, "iu").test(path)) {
		await expect(page.getByRole("link", { name: "Edit", exact: true })).toBeVisible();
		return;
	}

	if (path === "/characters/new/edit" || new RegExp(`^/characters/${RECORD_ID}/edit$`, "iu").test(path)) {
		await expect(page.getByRole("button", { name: "Save Character" })).toBeVisible();
		await expect(page.getByLabel("Character Name")).toBeVisible();
		return;
	}

	if (path === "/dm-logs") {
		await expect(page.locator('a[href^="/dm-logs/"]', { hasText: markers.dmLogTitle }).filter({ visible: true })).toBeVisible();
		await expect(
			page.locator('a[href^="/dm-logs/"]', { hasText: markers.secondDmLogTitle }).filter({ visible: true })
		).toBeVisible();
		return;
	}

	if (
		path === "/dm-logs/new" ||
		new RegExp(`^/dm-logs/${RECORD_ID}$`, "iu").test(path) ||
		new RegExp(`/log/(new|${RECORD_ID})$`, "iu").test(path)
	) {
		await expect(page.getByRole("button", { name: "Save Log" })).toBeVisible();
		await expect(page.getByLabel("Title")).toBeVisible();
		return;
	}

	if (path === "/dms") {
		await expect(page.locator('a[href^="/dms/"]', { hasText: markers.dmName }).filter({ visible: true })).toBeVisible();
		return;
	}

	if (path === `/dms/${markers.dmId}`) {
		await expect(page.getByRole("button", { name: "Save DM" })).toBeVisible();
		await expect(page.getByLabel("DM Name")).toHaveValue(markers.dmName);
		return;
	}

	if (new RegExp(`^/dms/${RECORD_ID}$`, "iu").test(path)) {
		await expect(page.getByRole("button", { name: "Save DM" })).toBeVisible();
		await expect(page.getByLabel("DM Name")).toBeVisible();
		return;
	}

	throw new Error(`No reload assertion for ${path}`);
}
