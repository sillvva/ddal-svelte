import type { Page, Route } from "@playwright/test";
import { logDescription, logImageKeys, pendingDeletion, uploadRowForKey } from "./db.ts";
import { expect, test } from "./fixtures.ts";
import { createCharacter, fieldIssue, fillGameLog, keyFromUrl, logIdOnCharacterPage, saveLog } from "./records.ts";
import { callCommand } from "./remote.ts";
import { deleteObject, objectExists, waitUntilMissing } from "./storage.ts";
import { dropFile, noteImageUrls, notesField, pasteFile, pngFile, TEXT_FILE, waitForNoteImages } from "./ui.ts";

const STAGED_NOTE_PUT = /\/tmp\/users\/[0-9a-f-]{36}\/notes\//iu;

function permanentOf(key: string) {
	return key.replace(/^tmp\//u, "");
}

function publicUrl(key: string) {
	const base = process.env.R2_PUBLIC_URL;
	if (!base) throw new Error("R2_PUBLIC_URL is not set");
	return `${base.replace(/\/+$/u, "")}/${key}`;
}

async function saveAndReturn(page: Page, characterId: string, title?: string) {
	await saveLog(page);
	await page.waitForURL(new RegExp(`/characters/${characterId}$`));
	return title ? logIdOnCharacterPage(page, title) : null;
}

async function pasteImage(page: Page, name: string, expected: number) {
	await pasteFile(notesField(page), pngFile(name));
	const urls = await waitForNoteImages(page, expected);
	const url = urls.at(-1);
	if (!url) throw new Error("The pasted image did not reach the notes");
	return url;
}

test("log notes: pasted and dropped images, promotion on save, and removal", async ({ users }) => {
	const { page } = await users.signUp({ label: "noteimages" });
	const characterId = await createCharacter(page, { name: "Note Images" });
	await fillGameLog(page, characterId, { title: "Pasted Images" });
	const notes = notesField(page);
	const save = page.getByRole("button", { name: "Save Log" });

	let staged: string[] = [];
	let permanent: string[] = [];
	let logId = "";

	await test.step("a paste inserts a placeholder at the caret, then the uploaded image", async () => {
		await notes.fill("Before\nAfter");
		await notes.evaluate((element) => {
			if (!(element instanceof HTMLTextAreaElement)) throw new Error("Notes is not a textarea");
			element.focus();
			element.setSelectionRange(7, 7);
		});

		// Hold the storage PUT so the placeholder and the blocked save are observable.
		let release = () => {};
		const held = new Promise<void>((resolve) => (release = resolve));
		const hold = async (route: Route) => {
			if (route.request().method() === "PUT") await held;
			await route.continue();
		};
		await page.route(STAGED_NOTE_PUT, hold);
		try {
			await pasteFile(notes, pngFile("map.png"));
			await expect(notes).toHaveValue(/^Before\n!\[Uploading image-[0-9a-f]{8}\]\(\)After$/u);
			await expect(save).toBeDisabled();
			await expect(page.getByRole("status").filter({ hasText: "Uploading 1 image" })).toBeVisible();
			release();
			const [url] = await waitForNoteImages(page, 1);
			await expect(notes).toHaveValue(`Before\n![map](${url})After`);
			await expect(save).toBeEnabled();
		} finally {
			release();
			await page.unroute(STAGED_NOTE_PUT, hold);
		}
	});

	await test.step("a drop appends to the end when the notes are not focused", async () => {
		await page.getByLabel("Title").focus();
		await dropFile(notes, pngFile("portrait.png"));
		const urls = await waitForNoteImages(page, 2);
		await expect(notes).toHaveValue(`Before\n![map](${urls[0]})After\n![portrait](${urls[1]})`);

		staged = urls.map((url) => keyFromUrl(url));
		for (const key of staged) {
			expect(key).toMatch(/^tmp\/users\/[0-9a-f-]{36}\/notes\//u);
			expect(await objectExists(key)).toBe(true);
		}
	});

	await test.step("a dropped file that is not an image is rejected", async () => {
		await dropFile(notes, TEXT_FILE);
		await expect(page.locator('[data-sonner-toast][data-type="error"]')).toContainText("Drop a JPEG, PNG, WebP, or GIF image.");
		expect(noteImageUrls(await notes.inputValue())).toHaveLength(2);
	});

	await test.step("saving promotes the staged images to permanent keys", async () => {
		logId = (await saveAndReturn(page, characterId, "Pasted Images")) ?? "";
		permanent = staged.map(permanentOf);

		const description = (await logDescription(logId)) ?? "";
		expect(description).not.toContain("/tmp/");
		expect(noteImageUrls(description).map((url) => keyFromUrl(url))).toEqual(permanent);
		expect(await logImageKeys(logId)).toEqual([...permanent].sort());
		for (const key of permanent) expect(await objectExists(key)).toBe(true);
		for (const key of staged) await waitUntilMissing(key);
	});

	await test.step("removing an image from the notes and saving purges its object", async () => {
		await page.goto(`/characters/${characterId}/log/${logId}`);
		await notes.fill(`Only the map ![map](${publicUrl(permanent[0] ?? "")})`);
		await saveAndReturn(page, characterId);

		await waitUntilMissing(permanent[1] ?? "");
		expect(await objectExists(permanent[0] ?? "")).toBe(true);
		expect(await logImageKeys(logId)).toEqual([permanent[0]]);
		expect(await uploadRowForKey(permanent[1] ?? "")).toBeNull();
		expect(await pendingDeletion(permanent[1] ?? "")).toBe(false);
	});
});

test("log notes: a shared image survives until no log references it, and deleting a log purges its images", async ({ users }) => {
	const { page } = await users.signUp({ label: "sharednotes" });
	const characterId = await createCharacter(page, { name: "Shared Notes" });

	let shared = "";
	let onlySecond = "";
	let firstLog = "";
	let secondLog = "";

	await test.step("save one image in the first log", async () => {
		await fillGameLog(page, characterId, { title: "First Log" });
		shared = permanentOf(keyFromUrl(await pasteImage(page, "shared.png", 1)));
		firstLog = (await saveAndReturn(page, characterId, "First Log")) ?? "";
		expect(await logImageKeys(firstLog)).toEqual([shared]);
	});

	await test.step("reference it from a second log next to an image of its own", async () => {
		await fillGameLog(page, characterId, { title: "Second Log" });
		await notesField(page).fill(`Shared ![shared](${publicUrl(shared)})`);
		onlySecond = permanentOf(keyFromUrl(await pasteImage(page, "second.png", 2)));
		secondLog = (await saveAndReturn(page, characterId, "Second Log")) ?? "";
		expect(await logImageKeys(secondLog)).toEqual([shared, onlySecond].sort());
	});

	await test.step("deleting the second log purges only the image no other log uses", async () => {
		const result = await callCommand(page, "src/lib/remote/logs/actions.remote.ts", "deleteLog", secondLog);
		expect(result.ok).toBe(true);
		await waitUntilMissing(onlySecond);
		expect(await uploadRowForKey(onlySecond)).toBeNull();
		expect(await objectExists(shared)).toBe(true);
		expect(await pendingDeletion(shared)).toBe(false);
	});

	await test.step("removing it from the last log that uses it purges it", async () => {
		await page.goto(`/characters/${characterId}/log/${firstLog}`);
		await notesField(page).fill("No images any more");
		await saveAndReturn(page, characterId);
		await waitUntilMissing(shared);
		expect(await logImageKeys(firstLog)).toEqual([]);
		expect(await uploadRowForKey(shared)).toBeNull();
	});
});

test("log notes: another user can't promote or claim my staged image, and expired uploads fail clearly", async ({ users }) => {
	const owner = await users.signUp({ label: "noteowner" });
	const intruder = await users.signUp({ label: "noteintruder" });
	const ownerCharacter = await createCharacter(owner.page, { name: "Owner Notes" });
	const intruderCharacter = await createCharacter(intruder.page, { name: "Intruder Notes" });

	let stagedUrl = "";
	let stagedKey = "";

	await test.step("the owner stages an image without saving", async () => {
		await fillGameLog(owner.page, ownerCharacter, { title: "Owner Log" });
		stagedUrl = await pasteImage(owner.page, "secret.png", 1);
		stagedKey = keyFromUrl(stagedUrl);
	});

	await test.step("another user saving the staged URL is refused and nothing is promoted", async () => {
		await fillGameLog(intruder.page, intruderCharacter, { title: "Borrowed Image" });
		await notesField(intruder.page).fill(`![stolen](${stagedUrl})`);
		await saveLog(intruder.page);
		await expect(fieldIssue(intruder.page, "description")).toContainText("not uploaded from this account");
		expect(intruder.page.url()).toMatch(/\/log\/new/u);
		expect(await objectExists(permanentOf(stagedKey))).toBe(false);
		expect(await objectExists(stagedKey)).toBe(true);
	});

	await test.step("another user can't complete the owner's upload", async () => {
		const upload = await uploadRowForKey(stagedKey);
		expect(upload?.purpose).toBe("note");
		const result = await callCommand(intruder.page, "src/lib/remote/images/actions.remote.ts", "completeNoteImage", {
			uploadId: upload?.id
		});
		expect(result.ok).toBe(false);
		expect(result.error?.status).toBe(404);
	});

	await test.step("a staged image that expired before save fails on the notes field", async () => {
		const expiredKey = keyFromUrl(await pasteImage(owner.page, "expired.png", 2));
		expect(await deleteObject(expiredKey)).toBe(true);
		await saveLog(owner.page);
		await expect(fieldIssue(owner.page, "description")).toContainText("no longer available");
		expect(await objectExists(permanentOf(stagedKey))).toBe(false);

		const kept = (await notesField(owner.page).inputValue()).replace(/!\[expired\]\([^)]+\)/u, "");
		await notesField(owner.page).fill(kept);
	});

	let ownerLog = "";
	await test.step("the owner still saves and promotes the image", async () => {
		ownerLog = (await saveAndReturn(owner.page, ownerCharacter, "Owner Log")) ?? "";
		expect(await logImageKeys(ownerLog)).toEqual([permanentOf(stagedKey)]);
	});

	await test.step("another user's log can show the permanent URL but does not keep it alive", async () => {
		const permanentUrl = publicUrl(permanentOf(stagedKey));
		await fillGameLog(intruder.page, intruderCharacter, { title: "Linked Image" });
		await notesField(intruder.page).fill(`![linked](${permanentUrl})`);
		const intruderLog = (await saveAndReturn(intruder.page, intruderCharacter, "Linked Image")) ?? "";
		expect(await logDescription(intruderLog)).toBe(`![linked](${permanentUrl})`);
		expect(await logImageKeys(intruderLog)).toEqual([]);

		await owner.page.goto(`/characters/${ownerCharacter}/log/${ownerLog}`);
		await notesField(owner.page).fill("Removed");
		await saveAndReturn(owner.page, ownerCharacter);
		await waitUntilMissing(permanentOf(stagedKey));
	});
});
