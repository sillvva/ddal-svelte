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
