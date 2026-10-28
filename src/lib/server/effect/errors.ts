import type { FullPathname } from "#lib/constants.js";
import type { NumericRange } from "#lib/util.js";
import { isInstanceOfClass } from "@sillvva/utils";
import { Cause, Data, Effect } from "effect";

export interface ErrorParams {
	message: string;
	status: NumericRange<300, 599>;
	cause?: unknown;
	[key: string]: unknown;
}

export interface ErrorClass {
	new (...args: unknown[]): { _tag: string } & ErrorParams;
}

export function isTaggedError(error: unknown): error is InstanceType<ErrorClass> {
	return (
		isInstanceOfClass(error) &&
		"status" in error &&
		typeof error.status === "number" &&
		error.status >= 400 &&
		error.status <= 599 &&
		"message" in error &&
		typeof error.message === "string" &&
		"_tag" in error &&
		typeof error._tag === "string"
	);
}

export class FailedError extends Data.TaggedError("FailedError")<ErrorParams> {
	constructor(action: string, cause?: unknown) {
		super({ message: `Failed to ${action}`, status: 500, cause });
	}
}

export class AuthTokenError extends Data.TaggedError("AuthTokenError")<ErrorParams> {
	constructor(message: string, cause?: unknown) {
		super({ message, status: 401, cause });
	}
}

// -------------------------------------------------------------------------------------------------
// RedirectError
// -------------------------------------------------------------------------------------------------

interface RedirectErrorParams extends ErrorParams {
	redirectTo: FullPathname;
	status: NumericRange<301, 308>;
}

/**
 * A redirect error is an error that is thrown when a redirect is needed.
 *
 * - 301 - Moved Permanently, always GET
 * - 302 - Moved Temporarily, always GET
 * - 303 - See Other, POST -> GET, after successful form submission
 * - 307 - Temporary Redirect, preserves method
 * - 308 - Permanent Redirect, preserves method
 */
export class RedirectError extends Data.TaggedError("RedirectError")<RedirectErrorParams> {
	constructor({
		message,
		redirectTo,
		status = 302,
		cause
	}: { message: string; redirectTo: FullPathname } & Partial<RedirectErrorParams>) {
		super({ message, redirectTo, status, cause });
	}
}

export function redirectOnFail<R, F extends InstanceType<ErrorClass> | Cause.UnknownError, S>(
	effect: Effect.Effect<R, F, S>,
	redirectTo: FullPathname,
	status: NumericRange<301, 308>
) {
	return effect.pipe(
		Effect.catch((err) => Effect.fail(new RedirectError({ message: err.message, redirectTo, status, cause: err })))
	);
}

// -------------------------------------------------------------------------------------------------
// Log serialization
// -------------------------------------------------------------------------------------------------

const MAX_DEPTH = 5;

const SECRET_KEY = /password|secret|token|authorization|cookie|credential|api[-_]?key|access[-_]?key|^\$response$|^headers$/i;

const SENSITIVE_TEXT: ReadonlyArray<readonly [RegExp, string]> = [
	[/X-Amz-Signature=[^&\s]+/gi, "X-Amz-Signature=[redacted]"],
	[/X-Amz-Credential=[^&\s]+/gi, "X-Amz-Credential=[redacted]"],
	[/X-Amz-Security-Token=[^&\s]+/gi, "X-Amz-Security-Token=[redacted]"],
	[/Bearer\s+\S+/gi, "Bearer [redacted]"],
	[/access_token=[^&\s]+/gi, "access_token=[redacted]"],
	[/refresh_token=[^&\s]+/gi, "refresh_token=[redacted]"],
	[/postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/gi, "postgres://[redacted]@"]
];

/**
 * Plain JSON value for an error stored in `AppLog` extra.
 *
 * Drizzle persists annotations with `JSON.stringify`. That drops non-enumerable
 * `message` and `stack` on `Error`, and Effect's `toJSON` keeps `message` but
 * still turns a native `Error` cause into `{}` and omits `stack`.
 */
export type SerializedError = {
	_tag?: string;
	name?: string;
	message?: string;
	status?: number;
	stack?: string;
	cause?: unknown;
	[key: string]: unknown;
};

export function serializeError(error: unknown): unknown {
	return serializeValue(error, 0, new WeakSet());
}

function serializeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
	if (typeof value === "string") return redactString(value);
	if (value == null || typeof value === "number" || typeof value === "boolean") return value;
	if (typeof value === "bigint") return value.toString();
	if (typeof value === "function" || typeof value === "symbol") return undefined;
	if (typeof value !== "object") return String(value);
	if (depth > MAX_DEPTH) return { message: "Max error cause depth exceeded" };

	if (seen.has(value)) return { message: "Circular error reference" };
	seen.add(value);

	if (value instanceof Error) return serializeErrorObject(value, depth, seen);
	if (value instanceof Date) return value.toISOString();
	if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return "[binary]";

	const json = readToJSON(value);
	if (json !== undefined && json !== value) return serializeValue(json, depth, seen);

	if (Array.isArray(value)) return value.map((item) => serializeValue(item, depth + 1, seen));

	const out: Record<string, unknown> = {};
	for (const key of Object.keys(value)) {
		if (isSecretKey(key)) continue;
		const child = serializeValue(readProperty(value, key), depth + 1, seen);
		if (child !== undefined) out[key] = child;
	}
	return out;
}

function serializeErrorObject(error: Error, depth: number, seen: WeakSet<object>): SerializedError {
	const record = error as Error & Record<string, unknown>;
	const out: SerializedError = {};

	if (typeof record._tag === "string") out._tag = record._tag;
	if (error.name) out.name = error.name;
	if (error.message) out.message = redactString(error.message);
	if (typeof record.status === "number") out.status = record.status;

	for (const key of Object.keys(record)) {
		if (key === "cause" || key === "stack" || key in out || isSecretKey(key)) continue;
		const child = serializeValue(readProperty(record, key), depth + 1, seen);
		if (child !== undefined) out[key] = child;
	}

	if (error.stack) out.stack = redactString(error.stack);
	if (error.cause !== undefined) out.cause = serializeValue(error.cause, depth + 1, seen);

	return out;
}

function readToJSON(value: object): unknown | undefined {
	const toJSON = (value as { toJSON?: unknown }).toJSON;
	if (typeof toJSON !== "function") return undefined;
	try {
		return toJSON.call(value);
	} catch {
		return undefined;
	}
}

function readProperty(value: object, key: string): unknown {
	try {
		return Reflect.get(value, key);
	} catch {
		return undefined;
	}
}

function isSecretKey(key: string): boolean {
	return SECRET_KEY.test(key);
}

function redactString(value: string): string {
	let redacted = value;
	for (const [pattern, replacement] of SENSITIVE_TEXT) {
		pattern.lastIndex = 0;
		redacted = redacted.replace(pattern, replacement);
	}
	return redacted;
}
