import { existsSync } from "node:fs";
import { resolve } from "node:path";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"]);

/** Highest priority first. `process.loadEnvFile` does not override variables that are already set. */
const ENV_FILES = [".env.development.local", ".env.local", ".env.development", ".env"] as const;

export class E2EGuardError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "E2EGuardError";
	}
}

export interface E2EEnv {
	E2E_ALLOW_LOCAL?: string;
	PUBLIC_URL?: string;
	PLAYWRIGHT_BASE_URL?: string;
	DATABASE_URL?: string;
	REMOTE_DB_URL?: string;
	R2_PUBLIC_URL?: string;
}

/** Public variables the app and the test process must agree on. Specs build and parse URLs from them. */
const SHARED_PUBLIC_ENV = ["PUBLIC_URL", "R2_PUBLIC_URL"] as const;

export function loadLocalEnv(root = process.cwd()) {
	for (const file of ENV_FILES) {
		const path = resolve(root, file);
		if (!existsSync(path)) continue;
		process.loadEnvFile(path);
	}
}

export function assertLocalE2E(env: E2EEnv) {
	const allow = env.E2E_ALLOW_LOCAL?.trim().toLowerCase();
	if (allow !== "1" && allow !== "true") {
		throw new E2EGuardError(
			"Refusing to run e2e. Set E2E_ALLOW_LOCAL=1 to opt in. This suite creates and deletes users and must never run against production or staging."
		);
	}

	if (env.REMOTE_DB_URL && env.DATABASE_URL && env.REMOTE_DB_URL === env.DATABASE_URL) {
		throw new E2EGuardError(
			"Refusing to run e2e. DATABASE_URL is identical to REMOTE_DB_URL. Staging shares production's database."
		);
	}

	const base = env.PLAYWRIGHT_BASE_URL || env.PUBLIC_URL;
	if (!base) {
		throw new E2EGuardError("Refusing to run e2e. Set PUBLIC_URL to the local app origin, for example http://localhost:5173.");
	}
	assertLocalHttpUrl(base, env.PLAYWRIGHT_BASE_URL ? "PLAYWRIGHT_BASE_URL" : "PUBLIC_URL");
	if (env.PUBLIC_URL) assertLocalHttpUrl(env.PUBLIC_URL, "PUBLIC_URL");
	if (env.PLAYWRIGHT_BASE_URL && env.PUBLIC_URL && new URL(env.PLAYWRIGHT_BASE_URL).origin !== new URL(env.PUBLIC_URL).origin) {
		throw new E2EGuardError(
			`Refusing to run e2e. PLAYWRIGHT_BASE_URL (${new URL(env.PLAYWRIGHT_BASE_URL).origin}) must match PUBLIC_URL (${new URL(env.PUBLIC_URL).origin}) so the passkey relying party is the local app.`
		);
	}

	if (!env.DATABASE_URL) {
		throw new E2EGuardError("Refusing to run e2e. DATABASE_URL must be a local Postgres URL. REMOTE_DB_URL is never used.");
	}
	assertLocalDatabase(env.DATABASE_URL);
}

export function localBaseURL() {
	return process.env.PLAYWRIGHT_BASE_URL || process.env.PUBLIC_URL || "http://localhost:5173";
}

/**
 * Outside CI, Playwright reuses any server already listening on the base URL, including
 * one started with a different environment or a port forwarded from another machine.
 * SvelteKit serves the app's public variables at `/_app/env.js`.
 */
export async function assertAppEnvMatches(baseURL: string, env: E2EEnv) {
	const origin = new URL(baseURL).origin;
	const response = await fetch(new URL("/_app/env.js", origin));
	if (!response.ok) throw new E2EGuardError(`Refusing to run e2e. ${origin}/_app/env.js answered ${response.status}.`);
	const source = await response.text();
	for (const name of SHARED_PUBLIC_ENV) {
		const expected = env[name];
		if (!expected) continue;
		const literal = source.match(new RegExp(`\\b${name}:("(?:[^"\\\\]|\\\\.)*")`))?.[1];
		const actual = literal ? (JSON.parse(literal) as string) : undefined;
		if (actual?.replace(/\/+$/, "") === expected.replace(/\/+$/, "")) continue;
		throw new E2EGuardError(
			`Refusing to run e2e. The app at ${origin} has ${name}=${actual ?? "<unset>"}, but the tests have ${name}=${expected}. ` +
				`Playwright reused a server started with a different environment. Stop whatever is listening on ${origin} with 'pnpm dev:kill' and rerun.`
		);
	}
}

function assertLocalHttpUrl(value: string, label: string) {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new E2EGuardError(`Refusing to run e2e. ${label} is not a URL.`);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new E2EGuardError(`Refusing to run e2e. ${label} must be http or https on a local host.`);
	}
	if (!isLocalHost(url.hostname)) {
		throw new E2EGuardError(
			`Refusing to run e2e. ${label} host "${url.hostname}" is not local. Production and staging are not allowed.`
		);
	}
}

function assertLocalDatabase(value: string) {
	let hostname: string;
	try {
		hostname = new URL(value).hostname;
	} catch {
		throw new E2EGuardError("Refusing to run e2e. DATABASE_URL is not a URL. REMOTE_DB_URL is never used.");
	}
	if (!isLocalHost(hostname)) {
		throw new E2EGuardError(
			`Refusing to run e2e. DATABASE_URL host "${hostname}" is not local. Staging shares production's database, so only a local database is allowed.`
		);
	}
}

function isLocalHost(hostname: string) {
	return LOCAL_HOSTS.has(hostname.replace(/^\[|\]$/g, "").toLowerCase());
}
