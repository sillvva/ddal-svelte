import { dev } from "$app/environment";
import { getRequestEvent } from "$app/server";
import type { LocalsUser } from "$lib/schemas";
import { isRedirectFailure, removeTrace } from "$lib/util";
import { error, isHttpError, isRedirect, redirect, type NumericRange, type RequestEvent } from "@sveltejs/kit";
import { Cause, Effect, Exit, ManagedRuntime } from "effect";
import { isFunction } from "effect/Predicate";
import type { YieldWrap } from "effect/Utils";
import { type ErrorClass } from "./errors";
import { AppLog } from "./logging";
import { AdminService } from "./services/admin";
import { assertAuth, AuthService } from "./services/auth";
import { CharacterService } from "./services/characters";
import { DMService } from "./services/dms";
import { LogService } from "./services/logs";
import { UserService } from "./services/users";

export type Services = CharacterService | LogService | DMService | UserService | AdminService | AuthService;
export type AppRuntime = ManagedRuntime.ManagedRuntime<Services, never>;

// -------------------------------------------------------------------------------------------------
// run
// -------------------------------------------------------------------------------------------------

// Overload signatures
export async function run<
	A,
	B extends InstanceType<ErrorClass>,
	C extends Services,
	T extends YieldWrap<Effect.Effect<A, B, C>>,
	X,
	Y
>(program: () => Generator<T, X, Y>): Promise<X>;

export async function run<A, B extends InstanceType<ErrorClass>, C extends Services>(
	program: Effect.Effect<A, B, C> | (() => Effect.Effect<A, B, C>)
): Promise<A>;

// Implementation
export async function run<
	A,
	B extends InstanceType<ErrorClass>,
	C extends Services,
	T extends YieldWrap<Effect.Effect<A, B, C>>,
	X,
	Y
>(program: Effect.Effect<A, B, C> | (() => Effect.Effect<A, B, C>) | (() => Generator<T, X, Y>)): Promise<A | X> {
	const event = getRequestEvent();
	const rt = event.locals.runtime;

	const effect = Effect.fn(function* () {
		if (isFunction(program)) {
			return yield* program();
		} else {
			return yield* program;
		}
	});

	const result = await rt.runPromiseExit(effect());
	return Exit.match(result, {
		onSuccess: (result) => result,
		onFailure: (cause) => {
			const err = handleCause(cause);
			if (isRedirectFailure(err)) {
				throw redirect(err.status, err.extra.redirectTo);
			}
			throw error(err.status, err.message);
		}
	});
}

// -------------------------------------------------------------------------------------------------
// runSafe
// -------------------------------------------------------------------------------------------------

export type EffectSuccess<A> = { ok: true; data: A };
export type EffectFailure = {
	ok: false;
	error: { message: string; status: NumericRange<300, 599>; extra: Record<string, unknown> };
};
export type EffectResult<A> = EffectSuccess<A> | EffectFailure;

// Overload signatures
export async function runSafe<
	A,
	B extends InstanceType<ErrorClass>,
	C extends Services,
	T extends YieldWrap<Effect.Effect<A, B, C>>,
	X,
	Y
>(program: () => Generator<T, X, Y>): Promise<EffectResult<X>>;

export async function runSafe<A, B extends InstanceType<ErrorClass>, C extends Services>(
	program: Effect.Effect<A, B, C> | (() => Effect.Effect<A, B, C>)
): Promise<EffectResult<A>>;

// Implementation
export async function runSafe<
	A,
	B extends InstanceType<ErrorClass>,
	C extends Services,
	T extends YieldWrap<Effect.Effect<A, B, C>>,
	X,
	Y
>(program: Effect.Effect<A, B, C> | (() => Effect.Effect<A, B, C>) | (() => Generator<T, X, Y>)): Promise<EffectResult<A | X>> {
	const event = getRequestEvent();
	const rt = event.locals.runtime;

	const effect = Effect.fn(function* () {
		if (isFunction(program)) {
			return yield* program();
		} else {
			return yield* program;
		}
	});

	const result = await rt.runPromiseExit(effect());
	return Exit.match(result, {
		onSuccess: (result) => ({ ok: true, data: result }),
		onFailure: (cause) => ({ ok: false, error: handleCause(cause) })
	});
}

// -------------------------------------------------------------------------------------------------
// handleCause
// -------------------------------------------------------------------------------------------------

export function handleCause<B extends InstanceType<ErrorClass>>(cause: Cause.Cause<B>) {
	let message = Cause.pretty(cause);
	let status: NumericRange<300, 599> = 500;
	const extra: Record<string, unknown> = {};

	if (Cause.isFailType(cause)) {
		const error = cause.error;
		status = error.status;
		if (error.cause) extra.cause = error.cause;

		for (const key in error) {
			if (!["_tag", "_op", "pipe", "name"].includes(key)) {
				extra[key] = error[key];
			}
		}

		Effect.runFork(AppLog.error(message, extra));
	}

	if (Cause.isDieType(cause)) {
		const defect = cause.defect;
		if (isRedirect(defect)) {
			message = `Redirect to ${defect.location}`;
			status = defect.status as NumericRange<300, 599>;
			extra.redirectTo = defect.location;
		} else if (isHttpError(defect)) {
			status = defect.status as NumericRange<300, 599>;
			message = defect.body.message;
		}
		if (typeof defect === "object" && defect !== null) {
			if ("stack" in defect) {
				extra.stack = defect.stack;
			}
			if ("status" in defect && typeof defect.status === "number") {
				status = defect.status as NumericRange<300, 599>;
			}
			if ("message" in defect && typeof defect.message === "string") {
				message = defect.message;
				Effect.runFork(AppLog.error(message, extra));
			}
		}
	}

	if (!dev) message = removeTrace(message);
	return { message, status, extra };
}

// -------------------------------------------------------------------------------------------------
// runAuth
// -------------------------------------------------------------------------------------------------

export async function runAuth<
	TReturn,
	A = unknown,
	B extends InstanceType<ErrorClass> = InstanceType<ErrorClass>,
	C extends Services = Services,
	T extends YieldWrap<Effect.Effect<A, B, C>> = YieldWrap<Effect.Effect<A, B, C>>,
	Y = unknown
>(program: (user: LocalsUser, event: RequestEvent) => Generator<T, TReturn, Y>, { adminOnly = false } = {}) {
	return run(function* () {
		const { user, event } = yield* assertAuth(adminOnly);
		return yield* program(user, event);
	});
}

export async function runAuthSafe<
	TReturn,
	A = unknown,
	B extends InstanceType<ErrorClass> = InstanceType<ErrorClass>,
	C extends Services = Services,
	T extends YieldWrap<Effect.Effect<A, B, C>> = YieldWrap<Effect.Effect<A, B, C>>,
	Y = unknown
>(program: (user: LocalsUser, event: RequestEvent) => Generator<T, TReturn, Y>, { adminOnly = false } = {}) {
	return runSafe(function* () {
		const { user, event } = yield* assertAuth(adminOnly);
		return yield* program(user, event);
	});
}
