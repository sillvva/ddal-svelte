import { dev } from "$app/environment";
import { getRequestEvent } from "$app/server";
import type { LocalsUser } from "$lib/schemas";
import { removeTrace } from "$lib/util";
import { error, isHttpError, isRedirect, redirect, type NumericRange } from "@sveltejs/kit";
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
			const { message, status, extra } = handleCause(cause);
			if (extra.redirectTo && typeof extra.redirectTo === "string" && status <= 308) {
				throw redirect(status, extra.redirectTo);
			}
			throw error(status, message);
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
// runAuth
// -------------------------------------------------------------------------------------------------

export async function runAuth<
	TReturn,
	A = unknown,
	B extends InstanceType<ErrorClass> = InstanceType<ErrorClass>,
	C extends Services = Services,
	T extends YieldWrap<Effect.Effect<A, B, C>> = YieldWrap<Effect.Effect<A, B, C>>,
	Y = unknown
>(program: (data: LocalsUser) => Generator<T, TReturn, Y>, { adminOnly = false }: { adminOnly?: boolean } = {}) {
	return run(function* () {
		const user = yield* assertAuth({ adminOnly, redirect: true });
		return yield* program(user);
	});
}

export async function runAuthSafe<
	TReturn,
	A = unknown,
	B extends InstanceType<ErrorClass> = InstanceType<ErrorClass>,
	C extends Services = Services,
	T extends YieldWrap<Effect.Effect<A, B, C>> = YieldWrap<Effect.Effect<A, B, C>>,
	Y = unknown
>(program: (data: LocalsUser) => Generator<T, TReturn, Y>, { adminOnly = false }: { adminOnly?: boolean } = {}) {
	return runSafe(function* () {
		const user = yield* assertAuth({ adminOnly });
		return yield* program(user);
	});
}
