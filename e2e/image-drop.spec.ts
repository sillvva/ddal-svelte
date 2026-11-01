import { expect, test } from "./fixtures.ts";
import { keyFromUrl } from "./records.ts";
import {
	avatarDropZone,
	dragFile,
	dropFile,
	pngFile,
	portraitDropZone,
	portraitField,
	TEXT_FILE,
	uploadAvatar,
	uploadCharacterImage
} from "./ui.ts";

const REJECTED = "Drop a JPEG, PNG, WebP, or GIF image.";

test("character portrait: drag feedback, rejected drops, and dropped uploads", async ({ users }) => {
	const { page } = await users.signUp({ label: "portraitdrop" });
	await page.goto("/characters/new/edit");
	const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Save Character" }) });
	const dropZone = portraitDropZone(form);
	const portrait = portraitField(form);

	await test.step("show the drop target while a file is dragged over", async () => {
		const drag = await dragFile(dropZone, pngFile("portrait.png"));
		await expect(dropZone.getByText("Drop image to upload", { exact: true })).toBeVisible();
		await drag.leave();
		await expect(dropZone.getByText("Drop image to upload", { exact: true })).toBeHidden();
	});

	await test.step("reject a dropped file that is not an image", async () => {
		await dropFile(dropZone, TEXT_FILE);
		await expect(dropZone.locator(".bg-error")).toHaveText(REJECTED);
		await expect(portrait).toHaveAttribute("aria-invalid", "true");
		await expect(portrait).toHaveValue("");

		await portrait.fill("https://example.com/portrait.png");
		await expect(dropZone.locator(".bg-error")).toHaveCount(0);
		await portrait.fill("");
	});

	await test.step("upload a dropped image into the portrait field", async () => {
		const staged = keyFromUrl(await uploadCharacterImage(form, "drop"));
		expect(staged.startsWith("tmp/")).toBe(true);
		await expect(dropZone.getByText("Drop image to upload", { exact: true })).toBeHidden();
	});
});

test("profile picture: dropped uploads and rejected drops", async ({ users }) => {
	const { page } = await users.signUp({ label: "avatardrop", onboard: false });
	const form = page.locator("form").filter({ has: page.getByLabel("Username") });
	const dropZone = avatarDropZone(form);

	await test.step("upload a dropped image", async () => {
		const staged = keyFromUrl(await uploadAvatar(form, "drop"));
		expect(staged.startsWith("tmp/")).toBe(true);
	});

	await test.step("reject a dropped file after an upload", async () => {
		await dropFile(dropZone, TEXT_FILE);
		await expect(dropZone.locator("p.bg-error")).toHaveText(REJECTED);
		await expect(dropZone.getByText("Drag and drop your image here", { exact: true })).toBeVisible();
		await expect(dropZone.getByText("Uploaded image", { exact: true })).toBeHidden();
	});
});
