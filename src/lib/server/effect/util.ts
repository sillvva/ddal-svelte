import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { invalid } from "@sveltejs/kit";
import { Data, Effect, Result } from "effect";
import { FailedError, type ErrorParams } from "./errors";

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;

const blockedNetworks = new BlockList();

function block4(network: string, prefix: number) {
	blockedNetworks.addSubnet(network, prefix, "ipv4");
}

function block6(network: string, prefix: number) {
	blockedNetworks.addSubnet(network, prefix, "ipv6");
}

block4("0.0.0.0", 8);
block4("10.0.0.0", 8);
block4("100.64.0.0", 10);
block4("127.0.0.0", 8);
block4("169.254.0.0", 16);
block4("172.16.0.0", 12);
block4("192.0.0.0", 24);
block4("192.0.2.0", 24);
block4("192.168.0.0", 16);
block4("198.18.0.0", 15);
block4("198.51.100.0", 24);
block4("203.0.113.0", 24);
block4("224.0.0.0", 4);
block4("240.0.0.0", 4);
blockedNetworks.addAddress("::", "ipv6");
blockedNetworks.addAddress("::1", "ipv6");
block6("fc00::", 7);
block6("fe80::", 10);
block6("ff00::", 8);
block6("2001:db8::", 32);

function ipv4FromMapped(address: string) {
	const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/iu.exec(address);
	if (dotted?.[1]) return dotted[1];

	const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/iu.exec(address);
	if (!hex?.[1] || !hex[2]) return null;
	const high = Number.parseInt(hex[1], 16);
	const low = Number.parseInt(hex[2], 16);
	if (!Number.isFinite(high) || !Number.isFinite(low) || high > 0xffff || low > 0xffff) return null;
	return `${high >>> 8}.${high & 0xff}.${low >>> 8}.${low & 0xff}`;
}

function isBlockedAddress(address: string): boolean {
	const mapped = ipv4FromMapped(address);
	if (mapped) return isBlockedAddress(mapped);
	const version = isIP(address);
	if (version === 4) return blockedNetworks.check(address, "ipv4");
	if (version === 6) return blockedNetworks.check(address, "ipv6");
	return true;
}

function normalizedHostname(hostname: string) {
	return hostname.replace(/\.$/, "").toLowerCase();
}

/** Loopback, private, link-local, and names that are not public hosts. */
function isUnsafeHostname(hostname: string) {
	const host = normalizedHostname(hostname);
	if (!host) return true;
	if (host === "localhost" || host.endsWith(".localhost")) return true;
	if (host.endsWith(".local") || host.endsWith(".localdomain") || host.endsWith(".internal")) return true;
	if (host === "metadata.google.internal" || host === "metadata.goog") return true;
	if (isIP(host) || ipv4FromMapped(host)) return isBlockedAddress(host);
	if (!host.includes(".")) return true;
	if (/^\d+$/u.test(host)) return true;

	const labels = host.split(".");
	if (labels.some((label) => label.length === 0 || label.length > 63)) return true;
	if (labels.some((label) => /^0x[0-9a-f]+$/iu.test(label) || /^0\d+$/u.test(label))) return true;
	return false;
}

async function resolvesToBlockedAddress(hostname: string) {
	const host = normalizedHostname(hostname);
	if (isIP(host) || ipv4FromMapped(host)) return isBlockedAddress(host);

	try {
		const records = await lookup(host, { all: true, verbatim: true });
		if (records.length === 0) return true;
		return records.some((record) => isBlockedAddress(record.address));
	} catch {
		return true;
	}
}

async function isSafePublicUrl(value: string) {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") return false;
	const hostname = normalizedHostname(url.hostname);
	if (isUnsafeHostname(hostname)) return false;
	if (await resolvesToBlockedAddress(hostname)) return false;
	return true;
}

/**
 * Fetches an http(s) URL. Redirects are followed manually so each hop is checked
 * for private, loopback, and link-local targets. Each request times out after 5 seconds.
 * Returns null when the URL is unsafe or the request fails.
 */
export async function fetchPublic(url: string, method: "GET" | "HEAD" = "GET") {
	const seen = new Set<string>();
	let current = url;
	let currentMethod = method;

	for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
		if (seen.has(current)) return null;
		seen.add(current);
		if (!(await isSafePublicUrl(current))) return null;

		let response: Response;
		try {
			response = await fetch(current, {
				method: currentMethod,
				redirect: "manual",
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
			});
		} catch {
			return null;
		}

		if (response.type === "opaqueredirect" || response.status === 0) {
			await response.body?.cancel().catch(() => undefined);
			return null;
		}

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get("location");
			await response.body?.cancel().catch(() => undefined);
			if (!location || hop === MAX_REDIRECTS) return null;
			current = new URL(location, current).href;
			if (response.status === 303) currentMethod = "GET";
			continue;
		}

		return response;
	}

	return null;
}

export const isValidUrl = Effect.fn(function* (url: string) {
	return yield* Effect.tryPromise({
		try: async () => {
			try {
				const response = await fetchPublic(url, "HEAD");
				if (!response) return false;
				try {
					return response.ok;
				} finally {
					await response.body?.cancel().catch(() => undefined);
				}
			} catch {
				return false;
			}
		},
		catch: () => new FailedError("check url")
	});
});

// -------------------------------------------------------------------------------------------------
// Validate
// -------------------------------------------------------------------------------------------------

interface InvalidSchemaErrorParams extends ErrorParams {
	input: unknown;
	issues: readonly StandardSchemaV1.Issue[];
}

export class InvalidSchemaError extends Data.TaggedError("InvalidSchemaError")<InvalidSchemaErrorParams> {
	constructor(input: unknown, summary: string, issues: readonly StandardSchemaV1.Issue[]) {
		super({ message: summary, status: 400, input, issues });
	}
}

export function getDotPath(issue: StandardSchemaV1.Issue) {
	let result = "input";

	const path = issue.path;
	if (!path) return "";

	for (let segment of path) {
		if (typeof segment === "object" && "key" in segment) {
			segment = segment.key;
		}
		if (typeof segment === "number") {
			result += `[${segment}]`;
		} else if (typeof segment === "string") {
			result += result === "" ? segment : "." + segment;
		}
	}

	return result;
}

function summarize(issues: readonly StandardSchemaV1.Issue[]) {
	let summary = "";
	for (const issue of issues) {
		if (summary) {
			summary += "\n";
		}
		summary += `\xD7 ${issue.message}`;
		const dotPath = getDotPath(issue);
		if (dotPath) {
			summary += `\n  \u2192 at ${dotPath}`;
		}
	}
	return summary;
}

export const parse = Effect.fn(function* <I, O = I>(schema: StandardSchemaV1<I, O>, input: I) {
	const parseResult = yield* Effect.tryPromise(() => Promise.resolve(schema["~standard"].validate(input)));
	if (parseResult.issues) {
		const summary = summarize(parseResult.issues);
		return yield* new InvalidSchemaError(input, summary, parseResult.issues);
	}
	return parseResult.value;
});

export const safeParse = Effect.fn(function* <I, O = I>(schema: StandardSchemaV1<I, O>, input: I) {
	const result = yield* Effect.result(parse<I, O>(schema, input));
	if (Result.isFailure(result)) return { success: false, failure: result.failure } as const;
	else return { success: true, data: result.success } as const;
});

export const formParse = Effect.fn(function* <I, O = I>(schema: StandardSchemaV1<I, O>, input: I) {
	const result = yield* safeParse(schema, input);
	if (!result.success) {
		if (result.failure instanceof InvalidSchemaError) invalid(...result.failure.issues);
		else invalid(result.failure.message);
	}
	return result.data;
});
