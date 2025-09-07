import type { Pathname } from "$app/types";
import type { FullPathname } from "$lib/constants";
import { type Awaitable } from "$lib/util";
import { type NumericRange, type RequestEvent } from "@sveltejs/kit";
import { Cause, Data, Effect, Either } from "effect";
import { superValidate, type Infer, type InferIn, type SuperValidated, type SuperValidateOptions } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import * as v from "valibot";
import { FormError, RedirectError, type ErrorClass, type ErrorParams } from "./errors";
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

export class InvalidSchemaError extends Data.TaggedError("InvalidSchemaError")<ErrorParams> {
	constructor(summary: string, input: unknown) {
		super({ message: summary, status: 400, input });
	}
}

export const parse = Effect.fn(function* <T extends v.GenericSchema>(
	schema: T,
	value: unknown,
	redirectTo?: FullPathname,
	status: NumericRange<300, 308> = 302
) {
	const parseResult = v.safeParse(schema, value);
	if (parseResult.success) return parseResult.output;
	else {
		const error = v.summarize(parseResult.issues);
		if (redirectTo) return yield* new RedirectError({ message: error, redirectTo, status, cause: parseResult.issues });
		else return yield* new InvalidSchemaError(error, value);
	}
});

export const parseEither = Effect.fn(function* <T extends v.GenericSchema>(
	schema: T,
	value: unknown,
	redirectTo?: FullPathname,
	status: NumericRange<300, 308> = 302
) {
	const result = yield* Effect.either(parse(schema, value, redirectTo, status));
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
