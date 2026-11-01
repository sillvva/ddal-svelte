import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** 1x1 PNG. The browser resizer accepts it and stores a tiny WebP or JPEG. */
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64"
);

export interface FilePayload {
	name: string;
	mimeType: string;
	buffer: Buffer;
}

export type UploadMethod = "browse" | "drop";

export function pngFile(name: string): FilePayload {
	return { name, mimeType: "image/png", buffer: PNG };
}

export const TEXT_FILE: FilePayload = { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Not an image") };

export const storageStatePath = "e2e/.state/storage.json";

export async function installPasskeyAuthenticator(context: BrowserContext) {
	await context.credentials.install();
}

/**
 * Vite serves the client as deferred modules, so a locator can be visible in the
 * server-rendered HTML before Svelte has attached event handlers. Clicks in that
 * window do nothing. `window.__svelte` is created by an inline script before those
 * handlers exist. Svelte 5 marks a hydrated element with an `events` symbol once
 * the handler is actually attached.
 */
export async function waitForHydration(page: Page) {
	await page.waitForFunction(
		() =>
			[...document.querySelectorAll("button, a, input, select, textarea")].some((element) =>
				Object.getOwnPropertySymbols(element).some((symbol) => symbol.description === "events")
			),
		undefined,
		{ timeout: 30_000 }
	);
}

/**
 * SvelteKit pushes the new URL before the destination page loads its data and renders,
 * so a matched URL doesn't mean the navigation is done. The root layout sets
 * `data-navigating` on `<html>` from `onNavigate` until `afterNavigate`.
 */
export async function waitForClientNavigation(page: Page) {
	await page.waitForFunction(() => !document.documentElement.hasAttribute("data-navigating"), undefined, {
		timeout: 30_000
	});
}

/**
 * Full page loads (`goto` and `location` navigations) must hydrate before the next click,
 * and client-side navigations must finish before the next `goto` or they can abort it.
 */
export function settleNavigations(page: Page) {
	const goto = page.goto.bind(page);
	const waitForURL = page.waitForURL.bind(page);
	page.goto = async (url, options) => {
		const response = await goto(url, options);
		await waitForHydration(page);
		return response;
	};
	page.waitForURL = async (url, options) => {
		await waitForURL(url, options);
		await waitForClientNavigation(page);
		await waitForHydration(page);
	};
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

/**
 * Starts an OS-style file drag over `target`. Playwright's `dragTo` only moves elements
 * already on the page, so the drag events are dispatched with a `DataTransfer` built here.
 */
export async function dragFile(target: Locator, file: FilePayload) {
	const dataTransfer = await target.page().evaluateHandle(
		({ name, mimeType, base64 }) => {
			const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
			const transfer = new DataTransfer();
			transfer.items.add(new File([bytes], name, { type: mimeType }));
			return transfer;
		},
		{ name: file.name, mimeType: file.mimeType, base64: file.buffer.toString("base64") }
	);
	await target.dispatchEvent("dragenter", { dataTransfer });
	await target.dispatchEvent("dragover", { dataTransfer });
	return {
		async drop() {
			await target.dispatchEvent("drop", { dataTransfer });
			await dataTransfer.dispose();
		},
		async leave() {
			await target.dispatchEvent("dragleave", { dataTransfer });
			await dataTransfer.dispose();
		}
	};
}

export async function dropFile(target: Locator, file: FilePayload) {
	const drag = await dragFile(target, file);
	await drag.drop();
}

async function chooseFile(dropZone: Locator, file: FilePayload, method: UploadMethod) {
	if (method === "drop") await dropFile(dropZone, file);
	else await dropZone.locator('input[type="file"]').setInputFiles(file);
}

export function avatarDropZone(scope: Locator) {
	return scope.getByRole("region", { name: "Image drop zone" });
}

export function portraitDropZone(scope: Locator) {
	return scope.getByRole("group", { name: /^Character portrait\b/ });
}

export function portraitField(scope: Locator) {
	// The field message is a second `<label>`, so its help text or error follows "Portrait" in the name.
	return scope.getByRole("textbox", { name: /^Portrait\b/ });
}

export async function uploadAvatar(scope: Locator, method: UploadMethod = "browse") {
	const dropZone = avatarDropZone(scope);
	const preview = dropZone.getByRole("img", { name: "Profile picture" });
	await chooseFile(dropZone, pngFile("avatar.png"), method);
	await expect
		.poll(
			async () => {
				const error = dropZone.locator("p.bg-error");
				if (await error.count()) return `error:${await error.first().innerText()}`;
				return (await preview.getAttribute("src")) ?? "";
			},
			{ timeout: 30_000 }
		)
		.toMatch(/\/tmp\/users\//);
	const src = await preview.getAttribute("src");
	if (!src) throw new Error("Avatar preview did not expose a stored URL");
	await expect(dropZone.getByText("Uploaded image", { exact: true })).toBeVisible();
	await expect(dropZone.getByText(src, { exact: true })).toBeVisible();
	return src;
}

export async function uploadCharacterImage(scope: Locator, method: UploadMethod = "browse") {
	const dropZone = portraitDropZone(scope);
	const portrait = portraitField(scope);
	await chooseFile(dropZone, pngFile("portrait.png"), method);
	await expect
		.poll(
			async () => {
				const error = dropZone.locator(".bg-error");
				if (await error.count()) return `error:${await error.first().innerText()}`;
				return portrait.inputValue();
			},
			{ timeout: 30_000 }
		)
		.toMatch(/\/tmp\/users\//);
	const src = await portrait.inputValue();
	await expect(dropZone.getByRole("img", { name: "Character portrait", exact: true })).toHaveAttribute("src", src);
	return src;
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
