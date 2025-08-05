import { dev } from "$app/environment";
import { getRequestEvent } from "$app/server";
import type { Pathname } from "$app/types";
import { privateEnv } from "$lib/env/private";
import type { AppLogSchema, UserId } from "$lib/schemas";
import { db, DrizzleError, runQuery } from "$lib/server/db";
import { appLogs } from "$lib/server/db/schema";
import { removeTrace } from "$lib/util";
import { isInstanceOfClass } from "@sillvva/utils";
import { error, isHttpError, isRedirect, type NumericRange, type RequestEvent } from "@sveltejs/kit";
import { Cause, Data, Effect, Exit, HashMap, Layer, Logger } from "effect";
import { isFunction, isTupleOf } from "effect/Predicate";
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

// -------------------------------------------------------------------------------------------------
// Logs
// -------------------------------------------------------------------------------------------------

export type Annotations = {
	routeId: string | null;
	params: Partial<Record<string, string>>;
	userId: UserId | undefined;
	username: string | undefined;
	extra: object;
};

const logLevel = Logger.withMinimumLogLevel(privateEnv.LOG_LEVEL);

const dbLogger = Logger.replace(
	Logger.defaultLogger,
	Logger.make((log) => {
		const values = {
			label: (log.message as string[]).join(" | "),
			timestamp: log.date,
			level: log.logLevel.label,
			annotations: Object.fromEntries(HashMap.toEntries(log.annotations)) as Annotations
		} satisfies Omit<AppLogSchema, "id">;

		runQuery(db.insert(appLogs).values([values]).returning({ id: appLogs.id })).pipe(
			Effect.andThen((logs) => {
				if (dev && isTupleOf(logs, 1))
					console.log(logs[0].id, dev && ["ERROR", "DEBUG"].includes(values.level) ? values : JSON.stringify(values), "\n");
			}),
			Effect.runPromise
		);
	})
);

function annotate(extra: Record<PropertyKey, any> = {}) {
	const event = getRequestEvent();
	return Effect.annotateLogs({
		userId: event.locals.user?.id,
		username: event.locals.user?.name,
		routeId: event.route.id,
		params: event.params,
		extra
	} satisfies Annotations);
}

export const Log = {
	info: (message: string, extra?: Record<PropertyKey, any>, logger: Layer.Layer<never> = dbLogger) =>
		Effect.logInfo(message).pipe(logLevel, annotate(extra), Effect.provide(logger)),
	error: (message: string, extra?: Record<PropertyKey, any>, logger: Layer.Layer<never> = dbLogger) =>
		Effect.logError(message).pipe(logLevel, annotate(extra), Effect.provide(logger)),
	debug: (message: string, extra?: Record<PropertyKey, any>, logger: Layer.Layer<never> = dbLogger) =>
		Effect.logDebug(message).pipe(logLevel, annotate(extra), Effect.provide(logger))
};

export const debugSet = Effect.fn("debugSet")(function* <S extends string>(service: S, impl: Function, result: unknown) {
	const call = impl.toString();
	if (call.includes(".set.")) {
		yield* Log.debug(service, {
			call: impl.toString(),
			result: Array.isArray(result) ? result.slice(0, 5) : result
		});
	}
});

// -------------------------------------------------------------------------------------------------
// Run
// -------------------------------------------------------------------------------------------------

function handleCause<B extends InstanceType<ErrorClass>>(cause: Cause.Cause<B>) {
	let message = Cause.pretty(cause);
	let status: NumericRange<400, 599> = 500;
	let failCause: unknown;
	const extra: Record<string, unknown> = {};

	if (Cause.isFailType(cause)) {
		const error = cause.error;
		status = error.status;
		failCause = error.cause;

		for (const key in error) {
			if (key !== "status" && key !== "cause") {
				extra[key] = error[key];
			}
		}
	}

	if (Cause.isDieType(cause)) {
		const defect = cause.defect;
		// This will propagate redirects and http errors directly to SvelteKit
		if (isRedirect(defect)) {
			Effect.runFork(Log.info(`Redirect to ${defect.location}`, defect));
			throw defect;
		} else if (isHttpError(defect)) {
			Effect.runFork(Log.error(`HttpError [${defect.status}] ${defect.body.message}`, defect));
			throw defect;
		} else if (typeof defect === "object" && defect !== null && "stack" in defect) {
			failCause = { stack: defect.stack };
		}
	}

	Effect.runFork(Log.error(message, { status, cause: failCause, ...extra }));

	if (!dev) message = removeTrace(message);
	return { message, status, extra };
}

// Overload signatures
export async function runOrThrow<A, B extends InstanceType<ErrorClass>, T extends YieldWrap<Effect.Effect<A, B>>, X, Y>(
	program: () => Generator<T, X, Y>
): Promise<X>;

export async function runOrThrow<A, B extends InstanceType<ErrorClass>>(
	program: Effect.Effect<A, B> | (() => Effect.Effect<A, B>)
): Promise<A>;

// Implementation
export async function runOrThrow<A, B extends InstanceType<ErrorClass>, T extends YieldWrap<Effect.Effect<A, B>>, X, Y>(
	program: Effect.Effect<A, B> | (() => Effect.Effect<A, B>) | (() => Generator<T, X, Y>)
): Promise<A | X> {
	const effect = Effect.fn(function* () {
		if (isFunction(program)) {
			return yield* program();
		} else {
			return yield* program;
		}
	});

	const result = await Effect.runPromiseExit(effect());
	return Exit.match(result, {
		onSuccess: (result) => result,
		onFailure: (cause) => {
			const { message, status } = handleCause(cause);
			throw error(status, message);
		}
	});
}

type RemoteResult<A> =
	| { ok: true; data: A }
	| { ok: false; error: { message: string; status: NumericRange<400, 599>; extra: Record<string, unknown> } };

// Overload signatures
export async function runOrReturn<A, B extends InstanceType<ErrorClass>, T extends YieldWrap<Effect.Effect<A, B>>, X, Y>(
	program: () => Generator<T, X, Y>
): Promise<RemoteResult<X>>;

export async function runOrReturn<A, B extends InstanceType<ErrorClass>>(
	program: Effect.Effect<A, B> | (() => Effect.Effect<A, B>)
): Promise<RemoteResult<A>>;

// Implementation
export async function runOrReturn<A, B extends InstanceType<ErrorClass>, T extends YieldWrap<Effect.Effect<A, B>>, X, Y>(
	program: Effect.Effect<A, B> | (() => Effect.Effect<A, B>) | (() => Generator<T, X, Y>)
): Promise<RemoteResult<A | X>> {
	const effect = Effect.fn(function* () {
		if (isFunction(program)) {
			return yield* program();
		} else {
			return yield* program;
		}
	});

	const result = await Effect.runPromiseExit(effect());
	return Exit.match(result, {
		onSuccess: (result) => ({ ok: true, data: result }),
		onFailure: (cause) => ({ ok: false, error: handleCause(cause) })
	});
}

// -------------------------------------------------------------------------------------------------
// Superforms
// -------------------------------------------------------------------------------------------------

export type SuperValidateData = RequestEvent | Request | FormData | URLSearchParams | URL | null | undefined;

function parseRemoteFormData(formData: FormData) {
	return JSON.parse(formData.get("data")?.toString() || "{}") as SuperValidateData;
}

export function validateRemoteForm<
	Input extends SuperValidateData | Partial<InferInput<Schema>>,
	Schema extends BaseSchema<any, any, any>
>(input: Input, schema: Schema, options?: SuperValidateOptions<InferOutput<Schema>>) {
	if (input instanceof FormData) {
		return Effect.promise(() => superValidate(parseRemoteFormData(input), valibot(schema), options));
	} else {
		return Effect.promise(() => superValidate(input, valibot(schema), options));
	}
}

export function validateForm<
	Input extends SuperValidateData | Partial<InferInput<Schema>>,
	Schema extends BaseSchema<any, any, any>
>(input: Input, schema: Schema, options?: SuperValidateOptions<InferOutput<Schema>>) {
	return Effect.promise(() => superValidate(input, valibot(schema), options));
}

// -------------------------------------------------------------------------------------------------
// Save
// -------------------------------------------------------------------------------------------------

export const save = Effect.fn(function* <
	TSuccess extends Pathname | TForm | Promise<Pathname | TForm>,
	TOut extends Record<PropertyKey, any>,
	TForm extends SuperValidated<TOut>,
	TIn extends Record<PropertyKey, any> = TOut
>(
	program: Effect.Effect<TIn, FormError<TOut, TIn> | DrizzleError>,
	handlers: {
		onError: (err: FormError<TOut, TIn>) => TForm;
		onSuccess: (data: TIn) => TSuccess;
	}
) {
	const runnable = program.pipe(Effect.catchTag("DrizzleError", FormError.from<TOut, TIn>));

	const result = yield* Effect.match(runnable, {
		onSuccess: handlers.onSuccess,
		onFailure: handlers.onError
	});

	Effect.runFork(Log.info("Result", { result }));
	return result;
});

// -------------------------------------------------------------------------------------------------
// Errors
// -------------------------------------------------------------------------------------------------

export interface ErrorParams {
	message: string;
	status: NumericRange<400, 599>;
	cause?: unknown;
	[key: string]: unknown;
}

export interface ErrorClass {
	new (...args: any[]): { _tag: string } & ErrorParams;
}

export function isTaggedError(error: unknown): error is InstanceType<ErrorClass> {
	return (
		isInstanceOfClass(error) &&
		"status" in error &&
		typeof error.status === "number" &&
		error.status >= 400 &&
		error.status <= 599 &&
		"cause" in error &&
		"message" in error &&
		typeof error.message === "string" &&
		"_tag" in error &&
		typeof error._tag === "string"
	);
}

export class FormError<
	TOut extends Record<PropertyKey, any>,
	TIn extends Record<PropertyKey, any> = TOut
> extends Data.TaggedError("FormError")<ErrorParams> {
	constructor(
		public message: string,
		protected options: Partial<{
			field: "" | FormPathLeavesWithErrors<TOut>;
			status: NumericRange<400, 599>;
			cause: unknown;
		}> = {}
	) {
		super({ message, status: options.status || 500, cause: options.cause });
	}

	static from<TOut extends Record<PropertyKey, any>, TIn extends Record<PropertyKey, any> = TOut>(
		err: unknown,
		field: "" | FormPathLeavesWithErrors<TOut> = ""
	): FormError<TOut, TIn> {
		if (isTaggedError(err)) return new FormError<TOut, TIn>(err.message, { cause: err.cause, status: err.status, field });
		return new FormError<TOut, TIn>(Cause.pretty(Cause.fail(err)), { cause: err, status: 500, field });
	}

	toForm(form: SuperValidated<TOut, App.Superforms.Message, TIn>) {
		return setError(form, this.options?.field ?? "", this.message, {
			status: this.status
		});
	}
}
