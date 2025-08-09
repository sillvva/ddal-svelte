import { dev } from "$app/environment";
import type { LocalsUser } from "$lib/schemas";
import { removeTrace } from "$lib/util";
import { error, isHttpError, isRedirect, type NumericRange, type RequestEvent } from "@sveltejs/kit";
import { Cause, Effect, Exit, Layer, ManagedRuntime } from "effect";
import { isFunction } from "effect/Predicate";
import type { YieldWrap } from "effect/Utils";
import { AppLog, type ErrorClass } from ".";
import { assertAuthOrFail, assertAuthOrRedirect } from "../auth";
import { DBService } from "../db";
import { AdminService } from "./admin";
import { CharacterService } from "./characters";
import { DMService } from "./dms";
import { LogService } from "./logs";
import { UserService } from "./users";

const appLayer = Layer.mergeAll(
	CharacterService.DefaultWithoutDependencies(),
	LogService.DefaultWithoutDependencies(),
	DMService.DefaultWithoutDependencies(),
	UserService.DefaultWithoutDependencies(),
	AdminService.DefaultWithoutDependencies()
).pipe(Layer.provide(DBService.Default()));

type Services = CharacterService | LogService | DMService | UserService | AdminService;
type AppRuntime = ManagedRuntime.ManagedRuntime<Services, never>;

// Overload signatures
export async function runOrThrow<
	A,
	B extends InstanceType<ErrorClass>,
	C extends Services,
	T extends YieldWrap<Effect.Effect<A, B, C>>,
	X,
	Y
>(program: (runtime: AppRuntime) => Generator<T, X, Y>, runtime?: AppRuntime): Promise<X>;

export async function runOrThrow<A, B extends InstanceType<ErrorClass>, C extends Services>(
	program: Effect.Effect<A, B, C> | ((runtime: AppRuntime) => Effect.Effect<A, B, C>),
	runtime?: AppRuntime
): Promise<A>;

// Implementation
export async function runOrThrow<
	A,
	B extends InstanceType<ErrorClass>,
	C extends Services,
	T extends YieldWrap<Effect.Effect<A, B, C>>,
	X,
	Y
>(
	program:
		| Effect.Effect<A, B, C>
		| ((runtime: AppRuntime) => Effect.Effect<A, B, C>)
		| ((runtime: AppRuntime) => Generator<T, X, Y>),
	runtime?: AppRuntime
): Promise<A | X> {
	const rt = runtime ?? ManagedRuntime.make(appLayer);

	try {
		const effect = Effect.fn(function* () {
			if (isFunction(program)) {
				return yield* program(rt);
			} else {
				return yield* program;
			}
		});

		const result = await rt.runPromiseExit(effect());
		return Exit.match(result, {
			onSuccess: (result) => result,
			onFailure: (cause) => {
				const { message, status } = handleCause(cause);
				throw error(status, message);
			}
		});
	} finally {
		await rt.dispose();
	}
}

export type EffectSuccess<A> = { ok: true; data: A };
export type EffectFailure = {
	ok: false;
	error: { message: string; status: NumericRange<400, 599>; extra: Record<string, unknown> };
};
export type EffectResult<A> = EffectSuccess<A> | EffectFailure;

// Overload signatures
export async function runOrReturn<
	A,
	B extends InstanceType<ErrorClass>,
	C extends Services,
	T extends YieldWrap<Effect.Effect<A, B, C>>,
	X,
	Y
>(program: (runtime: AppRuntime) => Generator<T, X, Y>, runtime?: AppRuntime): Promise<EffectResult<X>>;

export async function runOrReturn<A, B extends InstanceType<ErrorClass>, C extends Services>(
	program: Effect.Effect<A, B, C> | ((runtime: AppRuntime) => Effect.Effect<A, B, C>),
	runtime?: AppRuntime
): Promise<EffectResult<A>>;

// Implementation
export async function runOrReturn<
	A,
	B extends InstanceType<ErrorClass>,
	C extends Services,
	T extends YieldWrap<Effect.Effect<A, B, C>>,
	X,
	Y
>(
	program:
		| Effect.Effect<A, B, C>
		| ((runtime: AppRuntime) => Effect.Effect<A, B, C>)
		| ((runtime: AppRuntime) => Generator<T, X, Y>),
	runtime?: AppRuntime
): Promise<EffectResult<A | X>> {
	const rt = runtime ?? ManagedRuntime.make(appLayer);

	try {
		const effect = Effect.fn(function* () {
			if (isFunction(program)) {
				return yield* program(rt);
			} else {
				return yield* program;
			}
		});

		const result = await rt.runPromiseExit(effect());
		return Exit.match(result, {
			onSuccess: (result) => ({ ok: true, data: result }),
			onFailure: (cause) => ({ ok: false, error: handleCause(cause) })
		});
	} finally {
		await rt.dispose();
	}
}

export function handleCause<B extends InstanceType<ErrorClass>>(cause: Cause.Cause<B>) {
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

export async function authReturn<
	TReturn,
	A = unknown,
	B extends InstanceType<ErrorClass> = InstanceType<ErrorClass>,
	C extends Services = Services,
	T extends YieldWrap<Effect.Effect<A, B, C>> = YieldWrap<Effect.Effect<A, B, C>>,
	Y = unknown
>(
	program: (data: { user: LocalsUser; event: RequestEvent; runtime: AppRuntime }) => Generator<T, TReturn, Y>,
	adminOnly: boolean = false
): Promise<EffectResult<TReturn>> {
	return runOrReturn(function* (runtime) {
		const { user, event } = yield* assertAuthOrFail(adminOnly);
		return yield* program({ user, event, runtime });
	});
}

export async function authRedirect<
	TReturn,
	A = unknown,
	B extends InstanceType<ErrorClass> = InstanceType<ErrorClass>,
	C extends Services = Services,
	T extends YieldWrap<Effect.Effect<A, B, C>> = YieldWrap<Effect.Effect<A, B, C>>,
	Y = unknown
>(
	program: (data: { user: LocalsUser; event: RequestEvent; runtime: AppRuntime }) => Generator<T, TReturn, Y>,
	adminOnly: boolean = false
): Promise<TReturn> {
	return runOrThrow(function* (runtime) {
		const { user, event } = yield* assertAuthOrRedirect(adminOnly);
		return yield* program({ user, event, runtime });
	});
}
