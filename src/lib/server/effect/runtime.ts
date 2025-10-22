import { getRequestEvent } from "$app/server";
import { isRedirectFailure } from "$lib/factories.svelte";
import { getTrace } from "$lib/util";
import { omit } from "@sillvva/utils";
import { error, isHttpError, isRedirect, redirect, type NumericRange } from "@sveltejs/kit";
import { Cause, Effect, Exit, Layer, ManagedRuntime } from "effect";
import { isFunction } from "effect/Predicate";
import type { YieldWrap } from "effect/Utils";
import { DBService } from "../db";
import { type ErrorClass } from "./errors";
import { AppLog } from "./logging";
import { AdminService } from "./services/admin";
import { AuthService } from "./services/auth";
import { CharacterService } from "./services/characters";
import { DMService } from "./services/dms";
import { LogService } from "./services/logs";
import { UserService } from "./services/users";

export type Services = CharacterService | LogService | DMService | UserService | AdminService | AuthService;
export type AppRuntime = ManagedRuntime.ManagedRuntime<Services, never>;

export const createAppRuntime = () => {
	const dbLayer = DBService.Default();

	const serviceLayer = Layer.mergeAll(
		AuthService.DefaultWithoutDependencies(),
		AdminService.DefaultWithoutDependencies(),
		CharacterService.DefaultWithoutDependencies(),
		DMService.DefaultWithoutDependencies(),
		LogService.DefaultWithoutDependencies(),
		UserService.DefaultWithoutDependencies()
	);

	const appLayer = serviceLayer.pipe(Layer.provide(dbLayer));

	return ManagedRuntime.make(appLayer);
};

// -------------------------------------------------------------------------------------------------
// run
// -------------------------------------------------------------------------------------------------

// Overload signatures
export async function run<
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(program: () => Generator<T, X>): Promise<X>;

export async function run<R, F extends InstanceType<ErrorClass>, S extends Services>(
	program: Effect.Effect<R, F, S> | (() => Effect.Effect<R, F, S>)
): Promise<R>;

// Implementation
export async function run<
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(program: Effect.Effect<R, F, S> | (() => Effect.Effect<R, F, S>) | (() => Generator<T, X>)): Promise<R | X> {
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
				redirect(err.status, err.redirectTo);
			} else {
				error(err.status, err.message);
			}
		}
	});
}

// -------------------------------------------------------------------------------------------------
// runSafe
// -------------------------------------------------------------------------------------------------

export type EffectSuccess<R> = { ok: true; data: R };
export type EffectFailure = {
	ok: false;
	error: { message: string; stack: string; status: NumericRange<300, 599>; [key: string]: unknown };
};
export type EffectResult<R> = EffectSuccess<R> | EffectFailure;

// Overload signatures
export async function runSafe<
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(program: () => Generator<T, X>): Promise<EffectResult<X>>;

export async function runSafe<R, F extends InstanceType<ErrorClass>, S extends Services>(
	program: Effect.Effect<R, F, S> | (() => Effect.Effect<R, F, S>)
): Promise<EffectResult<R>>;

// Implementation
export async function runSafe<
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(program: Effect.Effect<R, F, S> | (() => Effect.Effect<R, F, S>) | (() => Generator<T, X>)): Promise<EffectResult<R | X>> {
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

export function handleCause<F extends InstanceType<ErrorClass>>(cause: Cause.Cause<F>) {
	let message = Cause.pretty(cause);
	let status: NumericRange<300, 599> = 500;
	let extra: Record<string, unknown> = {};

	if (Cause.isFailType(cause)) {
		const error = cause.error;

		status = error.status;
		extra.cause = error.cause;
		extra = Object.assign(extra, omit(error, ["_tag", "_op", "pipe", "name", "message", "status"]));

		Effect.runFork(AppLog.error(message, extra));
	}

	if (Cause.isDieType(cause)) {
		const defect = cause.defect;

		if (isRedirect(defect)) {
			message = `Redirect to ${defect.location}`;
			status = defect.status;
			extra.redirectTo = defect.location;
		} else if (isHttpError(defect)) {
			status = defect.status as NumericRange<300, 599>;
			message = defect.body.message;
		} else if (defect instanceof Error) {
			if (defect.name === "ValidationError") throw defect;
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

	const trace = getTrace(message);
	return { message: trace.message, stack: trace.stack, status, ...extra };
}
