import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** 1x1 PNG. The browser resizer accepts it and stores a tiny WebP or JPEG. */
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64"
);

export const storageStatePath = "e2e/.state/storage.json";

export async function installPasskeyAuthenticator(context: BrowserContext) {
	await context.credentials.install();
}

export function acceptDialogs(page: Page) {
	let nextPrompt: string | null = null;
	page.on("dialog", async (dialog) => {
		if (dialog.type() === "prompt") {
			const value = nextPrompt ?? dialog.defaultValue();
			nextPrompt = null;
			await dialog.accept(value);
			return;
		}
		await dialog.accept();
	});
	return {
		promptNext(value: string) {
			nextPrompt = value;
		}
	};
}

export async function uploadAvatar(scope: Locator) {
	await scope.locator('input[type="file"]').setInputFiles({
		name: "avatar.png",
		mimeType: "image/png",
		buffer: PNG
	});
	await expect
		.poll(
			async () => {
				const error = scope.locator("p.bg-error");
				if (await error.count()) return `error:${await error.first().innerText()}`;
				const src = await scope.getByRole("img", { name: "Profile picture" }).getAttribute("src");
				return src ?? "";
			},
			{ timeout: 30_000 }
		)
		.toMatch(/\/tmp\/users\//);
	const src = await scope.getByRole("img", { name: "Profile picture" }).getAttribute("src");
	if (!src) throw new Error("Avatar preview did not expose a stored URL");
	return src;
}

export async function uploadCharacterImage(scope: Locator) {
	await scope.getByRole("button", { name: "Upload", exact: true }).click();
	await scope.locator('input[type="file"]').setInputFiles({
		name: "portrait.png",
		mimeType: "image/png",
		buffer: PNG
	});
	const portrait = scope.getByLabel("Portrait");
	await expect
		.poll(
			async () => {
				const error = scope.locator("p.bg-error");
				if (await error.count()) return `error:${await error.first().innerText()}`;
				if ((await portrait.count()) === 0) return "";
				return portrait.inputValue({ timeout: 1_000 });
			},
			{ timeout: 30_000 }
		)
		.toMatch(/\/tmp\/users\//);
	return portrait.inputValue();
}

export async function openSettings(page: Page, handle: string) {
	await page.getByRole("button", { name: handle, exact: true }).click();
	await expect(page.locator("aside#settings")).toHaveAttribute("data-open", "true");
}

export async function closeSettings(page: Page) {
	const backdrop = page.locator("div.fixed.inset-0[data-open='true']");
	if (await backdrop.count()) await backdrop.first().click();
	await expect(page.locator("aside#settings")).toHaveAttribute("data-open", "false");
}

export async function saveStorageState(context: BrowserContext) {
	mkdirSync(dirname(storageStatePath), { recursive: true });
	await context.storageState({ path: storageStatePath });
}

export function characterIdFromUrl(url: string) {
	const match = new URL(url).pathname.match(/^\/characters\/([0-9a-f-]{36})$/iu);
	return match?.[1] ?? null;
}

export function logIdFromHref(href: string | null) {
	const match = href?.match(/\/log\/([0-9a-f-]{36})/iu) ?? href?.match(/^\/dm-logs\/([0-9a-f-]{36})/iu);
	return match?.[1] ?? null;
}
