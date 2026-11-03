import type { Page, Route } from "@playwright/test";
import * as devalue from "devalue";

/** SvelteKit `BINARY_FORM_CONTENT_TYPE`. */
const BINARY_FORM_CONTENT_TYPE = "application/x-sveltekit-formdata";
/** Version byte, then a u32 header length and a u16 file-offset length, both little-endian. */
const BINARY_FORM_PREFIX = 7;

export type FormFields = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRemoteCall(url: URL, name: string) {
	return url.pathname.includes("/_app/remote/") && url.pathname.endsWith(`/${name}`);
}

/** An unenhanced remote form posts natively to its `action`, `?/remote=<hash>/<name>[/<key>]`. */
function isNativeRemoteSubmit(url: URL, name: string) {
	return url.searchParams.get("/remote")?.split("/")[1] === name;
}

/**
 * Async Svelte hydrates a page's `await` blocks after the layout, so `waitForHydration` can pass
 * while the form is still server HTML and a click submits it natively. `RemoteForm` spreads a
 * delegated `oninput` onto the `<form>`, which Svelte records under its `events` symbol.
 */
async function waitForRemoteForm(page: Page, name: string) {
	await page.waitForFunction(
		(name) =>
			[...document.forms].some((form) => {
				const action = form.getAttribute("action");
				if (!action) return false;
				const id = new URL(action, location.href).searchParams.get("/remote");
				if (id?.split("/")[1] !== name) return false;
				return Object.getOwnPropertySymbols(form).some((symbol) => symbol.description === "events");
			}),
		name,
		{ timeout: 30_000 }
	);
}

function rewriteBinaryForm(body: Buffer, edit: (fields: FormFields) => void) {
	const version = body.readUInt8(0);
	const headerLength = body.readUInt32LE(1);
	const fileOffsetsLength = body.readUInt16LE(5);
	if (fileOffsetsLength) throw new Error("Rewriting a remote form that uploads files is not supported");

	const header = body.subarray(BINARY_FORM_PREFIX, BINARY_FORM_PREFIX + headerLength).toString("utf8");
	const decoded: unknown = devalue.parse(header);
	if (!Array.isArray(decoded) || !isRecord(decoded[0])) throw new Error("Unexpected remote form payload");
	const [fields, meta] = decoded;
	edit(fields);

	const next = Buffer.from(devalue.stringify([fields, meta]), "utf8");
	const prefix = Buffer.alloc(BINARY_FORM_PREFIX);
	prefix.writeUInt8(version, 0);
	prefix.writeUInt32LE(next.byteLength, 1);
	prefix.writeUInt16LE(0, 5);
	return Buffer.concat([prefix, next]);
}

/**
 * Lets the page build a normal remote form submission, then edits the decoded fields
 * before they reach the server. This is what a client that skips the UI can send.
 * Returns the number of submissions that were rewritten.
 */
export async function tamperWithForm(page: Page, name: string, edit: (fields: FormFields) => void) {
	let rewritten = 0;
	const matches = (url: URL) => isRemoteCall(url, name);
	const handler = async (route: Route) => {
		const request = route.request();
		const body = request.postDataBuffer();
		if (request.method() !== "POST" || !body || request.headers()["content-type"] !== BINARY_FORM_CONTENT_TYPE) {
			await route.fallback();
			return;
		}
		rewritten += 1;
		await route.continue({ postData: rewriteBinaryForm(body, edit) });
	};
	await page.route(matches, handler);
	return {
		get rewritten() {
			return rewritten;
		},
		dispose: () => page.unroute(matches, handler)
	};
}

export interface FormResponse {
	status: number;
	/** The raw remote form response. Issue and error messages appear in it as plain strings. */
	body: string;
}

/**
 * Edits the next submission of a remote form, triggers it with `submit`, and returns
 * what the server answered. Client-side checks run on the untampered fields first.
 */
export async function submitTampered(
	page: Page,
	name: string,
	edit: (fields: FormFields) => void,
	submit: () => Promise<void>
): Promise<FormResponse> {
	await waitForRemoteForm(page, name);
	const tamper = await tamperWithForm(page, name, edit);
	try {
		const answered = page.waitForResponse((response) => {
			if (response.request().method() !== "POST") return false;
			const url = new URL(response.url());
			return isRemoteCall(url, name) || isNativeRemoteSubmit(url, name);
		});
		await submit();
		const response = await answered;
		if (isNativeRemoteSubmit(new URL(response.url()), name)) {
			throw new Error(`The ${name} form submitted natively, before it was enhanced`);
		}
		if (tamper.rewritten !== 1) throw new Error(`Expected one ${name} submission to be rewritten, got ${tamper.rewritten}`);
		return { status: response.status(), body: await response.text() };
	} finally {
		await tamper.dispose();
	}
}

export interface CommandResult {
	ok: boolean;
	error?: { message: string; status: number };
}

/**
 * Calls an exported remote command with any argument, as a script in the page could.
 * It imports the module by its source path, which only the Vite dev server serves.
 * The Playwright web server always runs `vite dev`.
 */
export async function callCommand(page: Page, modulePath: `src/lib/remote/${string}.remote.ts`, name: string, arg: unknown) {
	const result: unknown = await page.evaluate(
		async ({ path, name, arg }) => {
			const mod: Record<string, unknown> = await import(/* @vite-ignore */ path);
			const command = mod[name];
			if (typeof command !== "function") throw new Error(`${path} has no export named ${name}`);
			const call = command as (arg: unknown) => Promise<unknown>;
			return await call(arg);
		},
		{ path: `/${modulePath}`, name, arg }
	);
	if (!isRecord(result) || typeof result.ok !== "boolean") throw new Error(`${name} returned an unexpected result`);
	const error = isRecord(result.error) ? result.error : undefined;
	return {
		ok: result.ok,
		error: error && {
			message: typeof error.message === "string" ? error.message : "",
			status: typeof error.status === "number" ? error.status : 0
		}
	} satisfies CommandResult;
}
