import { dev } from "$app/environment";
import { getRequestEvent } from "$app/server";
import type { Pathname } from "$app/types";
import { privateEnv } from "$lib/env/private";
import type { AppLogSchema, UserId } from "$lib/schemas";
import { db, runQuery } from "$lib/server/db";
import { appLogs } from "$lib/server/db/schema";
import { removeTrace, type Awaitable } from "$lib/util";
import { isInstanceOfClass } from "@sillvva/utils";
import { error, isHttpError, isRedirect, type NumericRange, type RequestEvent } from "@sveltejs/kit";
import { Cause, Data, Effect, Exit, HashMap, Layer, Logger } from "effect";
import { isFunction, isTupleOf } from "effect/Predicate";
import type { YieldWrap } from "effect/Utils";
import {
	setError,
	superValidate,
	type FormPathLeavesWithErrors,
	type Infer,
	type InferIn,
	type SuperValidated,
	type SuperValidateOptions
} from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import * as v from "valibot";

// -------------------------------------------------------------------------------------------------
// Logs
// -------------------------------------------------------------------------------------------------

export type Annotations = {
	userId: UserId | undefined;
	username: string | undefined;
	impersonatedBy?: UserId | null;
	routeId: string | null;
	params: Partial<Record<string, string>>;
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

function annotate(extra: Record<PropertyKey, unknown> = {}) {
	const event = getRequestEvent();
	return Effect.annotateLogs({
		userId: event.locals.user?.id,
		username: event.locals.user?.name,
		impersonatedBy: event.locals.session?.impersonatedBy,
		routeId: event.route.id,
		params: event.params,
		extra
	} satisfies Annotations);
}

export const AppLog = {
	info: (message: string, extra?: Record<string, unknown>, logger: Layer.Layer<never> = dbLogger) =>
		Effect.logInfo(message).pipe(logLevel, annotate(extra), Effect.provide(logger)),
	error: (message: string, extra?: Record<string, unknown>, logger: Layer.Layer<never> = dbLogger) =>
		Effect.logError(message).pipe(logLevel, annotate(extra), Effect.provide(logger)),
	debug: (message: string, extra?: Record<string, unknown>, logger: Layer.Layer<never> = dbLogger) =>
		Effect.logDebug(message).pipe(logLevel, annotate(extra), Effect.provide(logger))
};

export const debugSet = Effect.fn("debugSet")(function* <S extends string>(
	service: S,
	impl: (...args: unknown[]) => unknown,
	result: unknown
) {
	const call = impl.toString();
	if (call.includes(".set.")) {
		yield* AppLog.debug(service, {
			call: impl.toString(),
			result: Array.isArray(result) ? result.slice(0, 5) : result
		});
	}
});

// -------------------------------------------------------------------------------------------------
// Run
// -------------------------------------------------------------------------------------------------

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

export type EffectSuccess<A> = { ok: true; data: A };
export type EffectFailure = {
	ok: false;
	error: { message: string; status: NumericRange<400, 599>; extra: Record<string, unknown> };
};
export type EffectResult<A> = EffectSuccess<A> | EffectFailure;

// Overload signatures
export async function runOrReturn<A, B extends InstanceType<ErrorClass>, T extends YieldWrap<Effect.Effect<A, B>>, X, Y>(
	program: () => Generator<T, X, Y>
): Promise<EffectResult<X>>;

export async function runOrReturn<A, B extends InstanceType<ErrorClass>>(
	program: Effect.Effect<A, B> | (() => Effect.Effect<A, B>)
): Promise<EffectResult<A>>;

// Implementation
export async function runOrReturn<A, B extends InstanceType<ErrorClass>, T extends YieldWrap<Effect.Effect<A, B>>, X, Y>(
	program: Effect.Effect<A, B> | (() => Effect.Effect<A, B>) | (() => Generator<T, X, Y>)
): Promise<EffectResult<A | X>> {
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

function handleCause<B extends InstanceType<ErrorClass>>(cause: Cause.Cause<B>) {
	let message = Cause.pretty(cause);
	let status: NumericRange<400, 599> = 500;
	const extra: Record<string, unknown> = {};

	if (Cause.isFailType(cause)) {
		const error = cause.error;
		status = error.status;

		for (const key in error) {
			if (!["_tag", "_op", "pipe", "name"].includes(key)) {
				extra[key] = error[key];
			}
		}
	}

	if (Cause.isDieType(cause)) {
		const defect = cause.defect;
		// This will propagate redirects and http errors directly to SvelteKit
		if (isRedirect(defect)) {
			Effect.runFork(AppLog.info(`Redirect to ${defect.location}`, { defect }));
			throw defect;
		} else if (isHttpError(defect)) {
			Effect.runFork(AppLog.error(`HttpError [${defect.status}] ${defect.body.message}`, { defect }));
			throw defect;
		} else if (typeof defect === "object" && defect !== null && "stack" in defect) {
			extra.stack = defect.stack;
		}
	}

	Effect.runFork(AppLog.error(message, extra));

	if (!dev) message = removeTrace(message);
	return { message, status, extra };
}

// -------------------------------------------------------------------------------------------------
// Superforms
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

export const save = Effect.fn(function* <
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
	new (...args: unknown[]): { _tag: string } & ErrorParams;
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

export class FormError<SchemaOut extends Record<PropertyKey, unknown>> extends Data.TaggedError("FormError")<ErrorParams> {
	constructor(
		public message: string,
		protected options: Partial<{
			field: "" | FormPathLeavesWithErrors<SchemaOut>;
			status: NumericRange<400, 599>;
			cause: unknown;
		}> = {}
	) {
		super({ message, status: options.status || 500, cause: options.cause });
	}

	static from<SchemaOut extends Record<PropertyKey, unknown>>(
		err: unknown,
		field: "" | FormPathLeavesWithErrors<SchemaOut> = ""
	): FormError<SchemaOut> {
		if (isTaggedError(err)) return new FormError<SchemaOut>(err.message, { cause: err.cause, status: err.status, field });
		return new FormError<SchemaOut>(Cause.pretty(Cause.fail(err)), { cause: err, status: 500, field });
	}

	toForm(form: SuperValidated<SchemaOut>) {
		return setError(form, this.options?.field ?? "", this.message, {
			status: this.status
		});
	}
}
