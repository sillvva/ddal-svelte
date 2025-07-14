import { dev } from "$app/environment";
import { getRequestEvent } from "$app/server";
import { privateEnv } from "$lib/env/private";
import {
	error,
	isHttpError,
	isRedirect,
	redirect,
	type ActionFailure,
	type NumericRange,
	type RequestEvent
} from "@sveltejs/kit";
import { Cause, Context, Data, DateTime, Effect, Exit, Layer, Logger } from "effect";
import type { YieldWrap } from "effect/Utils";
import {
	setError,
	superValidate,
	type FormPathLeavesWithErrors,
	type SuperValidated,
	type SuperValidateOptions
} from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import type { BaseSchema, InferInput, InferOutput } from "valibot";
import { db, type Database, type Transaction } from "../db";

// -------------------------------------------------------------------------------------------------
// Logs
// -------------------------------------------------------------------------------------------------

const logLevel = Logger.withMinimumLogLevel(privateEnv.LOG_LEVEL);

function annotateError(extra: object = {}) {
	const event = getRequestEvent();
	return Effect.annotateLogs({
		currentTime: DateTime.formatIso(Effect.runSync(DateTime.now)),
		userId: event.locals.user?.id,
		routeId: event.route.id,
		params: event.params,
		extra
	});
}

export const Log = {
	info: (message: string, extra?: object, logger?: Layer.Layer<never>) =>
		Effect.logInfo(message).pipe(logLevel, annotateError(extra), Effect.provide(logger || Logger.json)),
	error: (message: string, extra?: object, logger?: Layer.Layer<never>) =>
		Effect.logError(message).pipe(logLevel, annotateError(extra), Effect.provide(logger || (dev ? Logger.pretty : Logger.json))),
	debug: (message: string, extra?: object, logger?: Layer.Layer<never>) =>
		Effect.logDebug(message).pipe(logLevel, annotateError(extra), Effect.provide(logger || (dev ? Logger.pretty : Logger.json)))
};

// -------------------------------------------------------------------------------------------------
// DB
// -------------------------------------------------------------------------------------------------

interface DBImpl {
	readonly db: Effect.Effect<Database | Transaction>;
}

export class DBService extends Context.Tag("Database")<DBService, DBImpl>() {}

export function DBLive(dbOrTx: Database | Transaction = db) {
	return Layer.succeed(DBService, DBService.of({ db: Effect.succeed(dbOrTx) }));
}

// -------------------------------------------------------------------------------------------------
// Run
// -------------------------------------------------------------------------------------------------

// Overload signatures
export async function run<T extends YieldWrap<Effect.Effect<A, B>>, A, B extends FetchError | FormError<any, any> | never, X, Y>(
	program: () => Generator<T, X, Y>
): Promise<X>;

export async function run<A, B extends FetchError | FormError<any, any> | never>(program: Effect.Effect<A, B>): Promise<A>;

// Implementation
export async function run(program: any): Promise<any> {
	const effect = Effect.gen(function* () {
		if (typeof program === "function") {
			// Generator function
			return yield* program();
		} else {
			// Effect
			return yield* program;
		}
	}) as Effect.Effect<any, FetchError | FormError<any, any> | never>;

	const result = await Effect.runPromiseExit(effect);
	return Exit.match(result, {
		onSuccess: (result) => result,
		onFailure: (cause) => {
			let message = Cause.pretty(cause);
			let status: NumericRange<400, 599> = 500;
			let failCause: unknown;

			if (Cause.isFailType(cause)) {
				const error = cause.error;
				if (error instanceof FormError || error instanceof FetchError) {
					status = error.status;
					failCause = error.cause;
				}
			}

			if (Cause.isDieType(cause)) {
				const defect = cause.defect;
				// This will propagate redirects and http errors directly to SvelteKit
				if (isRedirect(defect)) {
					Effect.runFork(Log.debug("Redirect", defect));
					throw defect;
				} else if (isHttpError(defect)) {
					Effect.runFork(Log.error("HttpError", defect));
					throw defect;
				}
			}

			Effect.runFork(Log.error(message, { status, cause: failCause }));

			if (!dev) message = message.replace(/\n\s+at .+/, "");
			throw error(status, message);
		}
	});
}

// -------------------------------------------------------------------------------------------------
// Superforms
// -------------------------------------------------------------------------------------------------

type SuperValidateData = RequestEvent | Request | FormData | URLSearchParams | URL | null | undefined;

export function validateForm<
	Input extends SuperValidateData | Partial<InferInput<Schema>>,
	Schema extends BaseSchema<any, any, any>
>(input: Input, schema: Schema, options?: SuperValidateOptions<InferOutput<Schema>>) {
	return Effect.promise(() => superValidate(input, valibot(schema), options));
}

// -------------------------------------------------------------------------------------------------
// Save
// -------------------------------------------------------------------------------------------------

export async function save<
	TOut extends Record<PropertyKey, any>,
	TIn extends Record<PropertyKey, any> = TOut,
	TError extends FormError<any, TIn> = FormError<any, TIn>,
	TSuccess extends any = any
>(
	program: Effect.Effect<TIn, TError>,
	handlers: {
		onError: (err: TError) => ActionFailure<{ form: SuperValidated<TOut, App.Superforms.Message, TIn> }>;
		onSuccess: (data: TIn) => TSuccess;
	}
) {
	const result = await Effect.runPromise(
		Effect.match(program, {
			onSuccess: handlers.onSuccess,
			onFailure: handlers.onError
		})
	);

	if (typeof result === "string" && result.startsWith("/")) {
		Effect.runFork(Log.debug("Redirect", { status: 302, location: result }));
		redirect(302, result);
	}

	if (typeof result === "object" && result !== null && "status" in result) {
		Effect.runFork(Log.error("ActionFailure", result));
	} else {
		Effect.runFork(Log.info("Result", { result }));
	}

	return result;
}

// -------------------------------------------------------------------------------------------------
// Errors
// -------------------------------------------------------------------------------------------------

export class FetchError extends Data.TaggedError("FetchError")<{
	message: string;
	status: NumericRange<400, 599>;
	cause?: unknown;
}> {
	constructor(
		public message: string,
		public status: NumericRange<400, 599> = 500,
		public cause?: unknown
	) {
		super({ message, status, cause });
	}

	static from(err: FetchError | Error | unknown): FetchError {
		if (err instanceof FetchError) return err;
		if (err instanceof FormError) return new FetchError(err.message, err.status, err.cause);
		return new FetchError(Cause.pretty(Cause.fail(err)), 500, err);
	}
}

export class FormError<
	TOut extends Record<PropertyKey, any>,
	TIn extends Record<PropertyKey, any> = TOut
> extends Data.TaggedError("FormError")<{
	message: string;
	status: NumericRange<400, 599>;
	cause?: unknown;
}> {
	cause?: unknown;
	status: NumericRange<400, 599> = 500;

	constructor(
		public message: string,
		protected options: Partial<{
			field: "" | FormPathLeavesWithErrors<TOut>;
			status: NumericRange<400, 599>;
			cause: unknown;
		}> = {}
	) {
		const status = options.status || 500;
		super({ message, status });
		this.cause = options.cause;
	}

	static from<TOut extends Record<PropertyKey, any>, TIn extends Record<PropertyKey, any> = TOut>(
		err: FormError<TOut, TIn> | Error | unknown
	): FormError<TOut, TIn> {
		if (err instanceof FormError) return err;
		if (err instanceof FetchError) return new FormError<TOut, TIn>(err.message, { cause: err.cause, status: err.status });
		return new FormError<TOut, TIn>(Cause.pretty(Cause.fail(err)), { cause: err, status: 500 });
	}

	toForm(form: SuperValidated<TOut, App.Superforms.Message, TIn>) {
		return setError(form, this.options?.field || "", this.message, {
			status: this.status
		});
	}
}
