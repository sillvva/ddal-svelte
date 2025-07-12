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

const logLevel = Logger.withMinimumLogLevel(privateEnv.LOG_LEVEL);

export const Logs = {
	logInfo: (...messages: unknown[]) => Effect.logInfo(messages.join(" ")).pipe(logLevel),
	logError: (...messages: unknown[]) => Effect.logError(messages.join(" ")).pipe(logLevel),
	logErrorJson: (...messages: unknown[]) => Effect.logError(...messages).pipe(logLevel, Effect.provide(Logger.json)),
	logDebug: (...messages: unknown[]) => Effect.logDebug(...messages).pipe(logLevel),
	logDebugJson: (...messages: unknown[]) => Effect.logDebug(...messages).pipe(logLevel, Effect.provide(Logger.json))
};

interface DBImpl {
	readonly db: Effect.Effect<Database | Transaction>;
}

export class DBService extends Context.Tag("Database")<DBService, DBImpl>() {}

export function withLiveDB(dbOrTx: Database | Transaction = db) {
	return Layer.succeed(DBService, DBService.of({ db: Effect.succeed(dbOrTx) }));
}

export async function runOrThrow<T>(program: Effect.Effect<T, FetchError | FormError<any, any> | never, never>) {
	const result = await Effect.runPromiseExit(program);
	return Exit.match(result, {
		onSuccess: (result) => result,
		onFailure: (cause) => {
			const message = Cause.match(cause, {
				onEmpty: "(empty)",
				onFail: (error) => `(error: ${error.message})`,
				onDie: (defect) => {
					// This will propagate redirects and http errors directly to SvelteKit
					if (isRedirect(defect)) {
						Effect.runFork(Logs.logInfo(`Redirecting to ${defect.location}`));
						throw defect;
					} else if (isHttpError(defect)) {
						Effect.runFork(Logs.logErrorJson(defect));
						throw defect;
					} else if (isError(defect)) {
						return `(error: ${defect.message})`;
					}

					return `(defect: ${defect})`;
				},
				onInterrupt: (fiberId) => `(fiberId: ${fiberId})`,
				onSequential: (left, right) => `(onSequential (left: ${left}) (right: ${right}))`,
				onParallel: (left, right) => `(onParallel (left: ${left}) (right: ${right})`
			});

			Effect.runFork(Logs.logErrorJson(message));
			throw error(500, message);
		}
	});
}

type SuperValidateData = RequestEvent | Request | FormData | URLSearchParams | URL | null | undefined;

export function validateForm<
	Input extends SuperValidateData | Partial<InferInput<Schema>>,
	Schema extends BaseSchema<any, any, any>
>(input: Input, schema: Schema, options?: SuperValidateOptions<InferOutput<Schema>>) {
	return Effect.promise(() => superValidate(input, valibot(schema), options));
}

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
		Effect.runFork(Logs.logInfo("Redirecting to", result));
		redirect(302, result);
	}

	Effect.runFork(typeof result === "object" ? Logs.logDebugJson(result) : Logs.logDebug("Result:", result));

	return result;
}

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
}> {
	constructor(public message: string = unknownError) {
		super({ message });
	}

	static from(err: FetchError | Error | unknown): FetchError {
		if (err instanceof FetchError) return err;
		return new FetchError(extractMessage(err));
	}
}

export class FormError<
	TOut extends Record<PropertyKey, any>,
	TIn extends Record<PropertyKey, any> = TOut
> extends Data.TaggedError("FormError")<{
	message: string;
}> {
	public status: NumericRange<400, 599> = 500;

	constructor(
		public message: string = unknownError,
		protected options: Partial<{
			field: "" | FormPathLeavesWithErrors<TOut>;
			status: NumericRange<400, 599>;
		}> = {}
	) {
		super({ message });
		if (options.status) this.status = options.status;
	}

	static from<TOut extends Record<PropertyKey, any>, TIn extends Record<PropertyKey, any> = TOut>(
		err: FormError<TOut, TIn> | Error | unknown
	): FormError<TOut, TIn> {
		if (err instanceof FormError) return err;
		return new FormError<TOut, TIn>(extractMessage(err));
	}

	toForm(form: SuperValidated<TOut, App.Superforms.Message, TIn>) {
		return setError(form, this.options?.field || "", this.message, {
			status: this.status
		});
	}
}
