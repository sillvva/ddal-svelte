import { dev } from "$app/environment";
import { getRequestEvent } from "$app/server";
import type { LocalsUser } from "$lib/schemas";
import { removeTrace } from "$lib/util";
import { error, isHttpError, isRedirect, type NumericRange } from "@sveltejs/kit";
import { Cause, Effect, Exit, ManagedRuntime } from "effect";
import { isFunction } from "effect/Predicate";
import type { YieldWrap } from "effect/Utils";
import { AppLog, type ErrorClass } from ".";
import { assertAuthOrFail, assertAuthOrRedirect } from "../auth";
import { AdminService } from "./admin";
import { CharacterService } from "./characters";
import { DMService } from "./dms";
import { LogService } from "./logs";
import { UserService } from "./users";

export type Services = CharacterService | LogService | DMService | UserService | AdminService;
export type AppRuntime = ManagedRuntime.ManagedRuntime<Services, never>;

// Overload signatures
export async function runOrThrow<
	A,
	B extends InstanceType<ErrorClass>,
	C extends Services,
	T extends YieldWrap<Effect.Effect<A, B, C>>,
	X,
	Y
>(program: () => Generator<T, X, Y>): Promise<X>;

export async function runOrThrow<A, B extends InstanceType<ErrorClass>, C extends Services>(
	program: Effect.Effect<A, B, C> | (() => Effect.Effect<A, B, C>)
): Promise<A>;

// Implementation
export async function runOrThrow<
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
export async function runOrReturn<
	A,
	B extends InstanceType<ErrorClass>,
	C extends Services,
	T extends YieldWrap<Effect.Effect<A, B, C>>,
	X,
	Y
>(program: () => Generator<T, X, Y>): Promise<EffectResult<X>>;

export async function runOrReturn<A, B extends InstanceType<ErrorClass>, C extends Services>(
	program: Effect.Effect<A, B, C> | (() => Effect.Effect<A, B, C>)
): Promise<EffectResult<A>>;

// Implementation
export async function runOrReturn<
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
>(program: (data: LocalsUser) => Generator<T, TReturn, Y>, adminOnly: boolean = false): Promise<EffectResult<TReturn>> {
	return runOrReturn(function* () {
		const user = yield* assertAuthOrFail(adminOnly);
		return yield* program(user);
	});
}

export async function authRedirect<
	TReturn,
	A = unknown,
	B extends InstanceType<ErrorClass> = InstanceType<ErrorClass>,
	C extends Services = Services,
	T extends YieldWrap<Effect.Effect<A, B, C>> = YieldWrap<Effect.Effect<A, B, C>>,
	Y = unknown
>(program: (user: LocalsUser) => Generator<T, TReturn, Y>, adminOnly: boolean = false): Promise<TReturn> {
	return runOrThrow(function* () {
		const user = yield* assertAuthOrRedirect(adminOnly);
		return yield* program(user);
	});
}
