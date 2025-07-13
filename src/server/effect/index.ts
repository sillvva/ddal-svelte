import { dev } from "$app/environment";
import { getRequestEvent } from "$app/server";
import { privateEnv } from "$lib/env/private";
import { isError } from "$lib/util";
import {
	error,
	isHttpError,
	isRedirect,
	redirect,
	type ActionFailure,
	type NumericRange,
	type RequestEvent
} from "@sveltejs/kit";
import { Cause, Context, Data, Effect, Exit, Layer, Logger } from "effect";
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

function annotateError(extra: Record<string, unknown> = {}) {
	const event = getRequestEvent();
	return Effect.annotateLogs({
		userId: event.locals.user?.id,
		routeId: event.route.id,
		params: event.params,
		extra
	});
}

export const Logs = {
	logInfo: (messages: unknown[], extra: Record<string, unknown> = {}) =>
		Effect.logInfo(messages.join(" ")).pipe(logLevel, annotateError(extra)),
	logError: (messages: unknown[], extra: Record<string, unknown> = {}) =>
		Effect.logError(messages.join(" ")).pipe(logLevel, annotateError(extra)),
	logErrorJson: (messages: unknown[], extra: Record<string, unknown> = {}) =>
		Effect.logError(...messages).pipe(logLevel, annotateError(extra), Effect.provide(dev ? Logger.structured : Logger.json)),
	logDebug: (messages: unknown[], extra: Record<string, unknown> = {}) =>
		Effect.logDebug(...messages).pipe(logLevel, annotateError(extra)),
	logDebugJson: (messages: unknown[], extra: Record<string, unknown> = {}) =>
		Effect.logDebug(...messages).pipe(logLevel, annotateError(extra), Effect.provide(dev ? Logger.structured : Logger.json))
};

// -------------------------------------------------------------------------------------------------
// DB
// -------------------------------------------------------------------------------------------------

interface DBImpl {
	readonly db: Effect.Effect<Database | Transaction>;
}

export class DBService extends Context.Tag("Database")<DBService, DBImpl>() {}

export function withLiveDB(dbOrTx: Database | Transaction = db) {
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

			if (Cause.isFailType(cause)) {
				const error = cause.error;
				if (error instanceof FormError || error instanceof FetchError) {
					status = error.status;
				}
			}

			if (Cause.isDieType(cause)) {
				const defect = cause.defect;
				// This will propagate redirects and http errors directly to SvelteKit
				if (isRedirect(defect)) {
					Effect.runFork(Logs.logInfo([`Redirecting to ${defect.location}`]));
					throw defect;
				} else if (isHttpError(defect)) {
					Effect.runFork(Logs.logErrorJson([defect], { status: defect.status }));
					throw defect;
				} else if (isError(defect)) {
					message = `Error: ${defect.message}`;
				}
			}

			if (!dev) message = message.replace(/\n\s+at .+/, "");

			Effect.runFork(Logs.logErrorJson([cause], { status }));
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
		Effect.runFork(Logs.logInfo(["Redirecting to", result]));
		redirect(302, result);
	}

	Effect.runFork(typeof result === "object" ? Logs.logDebugJson([result]) : Logs.logDebug(["Result:", result]));

	return result;
}

// -------------------------------------------------------------------------------------------------
// Errors
// -------------------------------------------------------------------------------------------------

const unknownError = "Unknown error";

function hasMessage(obj: unknown): obj is { message: string } {
	return typeof obj === "object" && obj !== null && "message" in obj && typeof (obj as any).message === "string";
}

function extractMessage(err: unknown): string {
	if (!err) return "Undefined error";
	if (typeof err === "string") return err;
	if (hasMessage(err)) return err.message;
	return "Unknown error";
}

export class FetchError extends Data.TaggedError("FetchError")<{
	message: string;
	status: NumericRange<400, 599>;
	cause?: unknown;
}> {
	constructor(
		public message: string = unknownError,
		public status: NumericRange<400, 599> = 500,
		public cause?: unknown
	) {
		super({ message, status, cause });
	}

	static from(err: FetchError | Error | unknown): FetchError {
		if (err instanceof FetchError) return err;
		if (err instanceof FormError) return new FetchError(err.message, err.status, err.cause);
		return new FetchError(extractMessage(err), 500, err);
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
		public message = unknownError,
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
		return new FormError<TOut, TIn>(extractMessage(err), { cause: err, status: 500 });
	}

	toForm(form: SuperValidated<TOut, App.Superforms.Message, TIn>) {
		return setError(form, this.options?.field || "", this.message, {
			status: this.status
		});
	}
}
