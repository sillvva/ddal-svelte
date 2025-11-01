import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Data, Effect, Either } from "effect";

export const isValidUrl = Effect.fn(function* (url: string) {
	return yield* Effect.promise(() => fetch(url, { method: "HEAD" }).catch(() => ({ ok: false }))).pipe(
		Effect.flatMap((response) => Effect.succeed(response.ok))
	);
});

import { type ErrorParams } from "./errors";

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
	const parseResult = yield* Effect.promise(() => Promise.resolve(schema["~standard"].validate(input)));
	if (parseResult.issues) {
		const summary = summarize(parseResult.issues);
		return yield* new InvalidSchemaError(input, summary, parseResult.issues);
	}
	return parseResult.value;
});

export const safeParse = Effect.fn(function* <I, O = I>(schema: StandardSchemaV1<I, O>, input: I) {
	const result = yield* Effect.either(parse<I, O>(schema, input));
	if (Either.isLeft(result)) return { success: false, failure: result.left } as const;
	else return { success: true, data: result.right } as const;
});
