import type { Pathname } from "$app/types";
import { removeTrace, type Awaitable } from "$lib/util";
import { type RequestEvent } from "@sveltejs/kit";
import { Cause, Effect } from "effect";
import { superValidate, type Infer, type InferIn, type SuperValidated, type SuperValidateOptions } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import * as v from "valibot";
import { FormError, type ErrorClass } from "./errors";
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
		onError: (err: FormError<SchemaOut>) => Awaitable<TFailure>;
		onSuccess: (data: ServiceOut) => Awaitable<TSuccess>;
	}
) {
	return yield* program.pipe(
		Effect.catchAll(FormError.from<SchemaOut>),
		Effect.match({
			onSuccess: handlers.onSuccess,
			onFailure: async (error) => {
				const result = await handlers.onError(error);

				const message = removeTrace(Cause.pretty(Cause.fail(error)));
				Effect.runFork(AppLog.error(`SaveError: ${message}`, { result, error }));

				return result;
			}
		}),
		Effect.flatMap((result) => Effect.promise(async () => result))
	);
});
