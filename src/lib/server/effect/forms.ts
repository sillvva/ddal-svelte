import type { Pathname } from "$app/types";
import { type Awaitable } from "$lib/util";
import { type RequestEvent } from "@sveltejs/kit";
import { Cause, Data, Effect, Either } from "effect";
import { superValidate, type Infer, type InferIn, type SuperValidated, type SuperValidateOptions } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import * as v from "valibot";
import { FormError, type ErrorClass, type ErrorParams } from "./errors";
import { AppLog } from "./logging";

// -------------------------------------------------------------------------------------------------
// Validate
// -------------------------------------------------------------------------------------------------

export type SuperValidateData = RequestEvent | Request | FormData | URLSearchParams | URL | null | undefined;

export function validateForm<
	Schema extends v.GenericSchema,
	Input extends SuperValidateData | Partial<InferIn<Schema, "valibot">>
>(input: Input, schema: Schema, options?: SuperValidateOptions<Infer<Schema, "valibot">>) {
	return Effect.promise(() => superValidate(input, valibot(schema), options));
}

interface InvalidSchemaErrorParams<T extends v.GenericSchema> extends ErrorParams {
	input: unknown;
	issues: [v.InferIssue<T>, ...v.InferIssue<T>[]];
}

export class InvalidSchemaError<T extends v.GenericSchema> extends Data.TaggedError("InvalidSchemaError")<
	InvalidSchemaErrorParams<T>
> {
	constructor(input: unknown, summary: string, issues: [v.InferIssue<T>, ...v.InferIssue<T>[]]) {
		super({ message: summary, status: 400, input, issues });
	}
}

export const parse = Effect.fn(function* <T extends v.GenericSchema>(schema: T, input: unknown) {
	const parseResult = v.safeParse(schema, input);
	if (parseResult.success) return parseResult.output;
	else {
		const summary = v.summarize(parseResult.issues);
		return yield* new InvalidSchemaError(input, summary, parseResult.issues);
	}
});

export const safeParse = Effect.fn(function* <T extends v.GenericSchema>(schema: T, input: unknown) {
	const result = yield* Effect.either(parse(schema, input));
	if (Either.isLeft(result)) return { success: false, failure: result.left } as const;
	else return { success: true, data: result.right } as const;
});

// -------------------------------------------------------------------------------------------------
// Save
// -------------------------------------------------------------------------------------------------

export const saveForm = Effect.fn(function* <
	TSuccess extends Pathname | TForm,
	TFailure extends Pathname | TForm,
	TForm extends SuperValidated<SchemaOut>,
	SchemaOut extends Record<PropertyKey, unknown>,
	ServiceOut = unknown
>(
	program: Effect.Effect<ServiceOut, FormError<SchemaOut> | InstanceType<ErrorClass>>,
	handlers: {
		onSuccess: (data: ServiceOut) => Awaitable<TSuccess>;
		onError: (err: FormError<SchemaOut>) => Awaitable<TFailure>;
	}
) {
	return yield* program.pipe(
		Effect.catchAll(FormError.from<SchemaOut>),
		Effect.match({
			onSuccess: handlers.onSuccess,
			onFailure: async (error) => {
				const result = await handlers.onError(error);

				const message = Cause.pretty(Cause.fail(error));
				Effect.runFork(AppLog.error(message, { result, error }));

				return result;
			}
		}),
		Effect.flatMap((result) => Effect.promise(async () => result))
	);
});
