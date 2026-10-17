import { getTrace, isRedirectFailure, type NumericRange } from "#lib/util.js";
import { getRequestEvent } from "$app/server";
import { isFunction, omit } from "@sillvva/utils";
import { error, isHttpError, isRedirect, redirect } from "@sveltejs/kit";
import { Cause, Effect, Exit, Layer, ManagedRuntime } from "effect";
import { DBService } from "../db";
import { isTaggedError, type ErrorClass } from "./errors";
import { AppLog } from "./logging";
import { captureRemoteSource, labelMessage, remoteLabel } from "./remote-label.js";
import { AdminService } from "./services/admin";
import { AuthService } from "./services/auth";
import { CharacterService } from "./services/characters";
import { DMService } from "./services/dms";
import { LogService } from "./services/logs";

export type Services = CharacterService | LogService | DMService | AdminService | AuthService;
export type AppRuntime = ManagedRuntime.ManagedRuntime<Services, never>;

export const createAppRuntime = () => {
	const dbLayer = DBService.layer();

	const serviceLayer = Layer.mergeAll(
		AuthService.layer,
		AdminService.layer,
		CharacterService.layer,
		DMService.layer,
		LogService.layer
	);

	const appLayer = serviceLayer.pipe(Layer.provide(dbLayer));

	return ManagedRuntime.make(appLayer);
};

// -------------------------------------------------------------------------------------------------
// run
// -------------------------------------------------------------------------------------------------

export type RunOptions = {
	/** Remote export that owns this program, such as `auth.queries.getAccounts`. */
	remote?: string;
};

type Runnable<R, F extends InstanceType<ErrorClass> | Cause.UnknownError, S extends Services, T extends Effect.Effect<R, F, S>, X> =
	| Effect.Effect<R, F, S>
	| (() => Effect.Effect<R, F, S>)
	| (() => Generator<T, X>);

function resolveRemote(options?: RunOptions) {
	return options?.remote ?? remoteLabel(undefined, captureRemoteSource());
}

function programEffect<
	R,
	F extends InstanceType<ErrorClass> | Cause.UnknownError,
	S extends Services,
	T extends Effect.Effect<R, F, S>,
	X
>(remote: string | undefined, program: Runnable<R, F, S, T, X>) {
	const body = function* () {
		if (isFunction(program)) {
			return yield* program();
		} else {
			return yield* program;
		}
	};

	return remote ? Effect.fn(remote)(body) : Effect.fn(body);
}

// Overload signatures
export async function run<
	R,
	F extends InstanceType<ErrorClass> | Cause.UnknownError,
	S extends Services,
	T extends Effect.Effect<R, F, S>,
	X
>(program: () => Generator<T, X>, options?: RunOptions): Promise<X>;

export async function run<R, F extends InstanceType<ErrorClass> | Cause.UnknownError, S extends Services>(
	program: Effect.Effect<R, F, S> | (() => Effect.Effect<R, F, S>),
	options?: RunOptions
): Promise<R>;

// Implementation
export async function run<
	R,
	F extends InstanceType<ErrorClass> | Cause.UnknownError,
	S extends Services,
	T extends Effect.Effect<R, F, S>,
	X
>(program: Runnable<R, F, S, T, X>, options?: RunOptions): Promise<R | X> {
	const event = getRequestEvent();
	const rt = event.locals.runtime;
	const remote = resolveRemote(options);
	const effect = programEffect(remote, program);

	const result = await rt.runPromiseExit(effect());
	return Exit.match(result, {
		onSuccess: (result) => result,
		onFailure: (cause) => {
			const err = handleCause(cause, remote);
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
export type EffectError = {
	name: string;
	type: Cause.Reason<unknown>["_tag"] | "Empty";
	message: string;
	stack: string;
	status: NumericRange<300, 599>;
	cause?: unknown;
	defect?: unknown;
	redirectTo?: unknown;
};
export type EffectFailure = {
	ok: false;
	error: EffectError;
};
export type EffectResult<R> = EffectSuccess<R> | EffectFailure;

/** Command payload sent to the client. `stack` stays on the server. */
export type ClientEffectResult<R> =
	| EffectSuccess<R>
	| {
			ok: false;
			error: Omit<EffectError, "stack">;
	  };

// Overload signatures
export async function runSafe<
	R,
	F extends InstanceType<ErrorClass> | Cause.UnknownError,
	S extends Services,
	T extends Effect.Effect<R, F, S>,
	X
>(program: () => Generator<T, X>, options?: RunOptions): Promise<EffectResult<X>>;

export async function runSafe<R, F extends InstanceType<ErrorClass> | Cause.UnknownError, S extends Services>(
	program: Effect.Effect<R, F, S> | (() => Effect.Effect<R, F, S>),
	options?: RunOptions
): Promise<EffectResult<R>>;

// Implementation
export async function runSafe<
	R,
	F extends InstanceType<ErrorClass> | Cause.UnknownError,
	S extends Services,
	T extends Effect.Effect<R, F, S>,
	X
>(program: Runnable<R, F, S, T, X>, options?: RunOptions): Promise<EffectResult<R | X>> {
	const event = getRequestEvent();
	const rt = event.locals.runtime;
	const remote = resolveRemote(options);
	const effect = programEffect(remote, program);

	const result = await rt.runPromiseExit(effect());
	return Exit.match(result, {
		onSuccess: (result) => ({ ok: true, data: result }),
		onFailure: (cause) => ({ ok: false, error: handleCause(cause, remote) })
	});
}

// -------------------------------------------------------------------------------------------------
// handleCause
// -------------------------------------------------------------------------------------------------

export function handleCause<F extends InstanceType<ErrorClass> | Cause.UnknownError>(
	cause: Cause.Cause<F>,
	remote?: string
): EffectError {
	const reason = cause.reasons.find((entry) => Cause.isFailReason(entry) || Cause.isDieReason(entry)) ?? cause.reasons[0];
	let name = `Unknown${reason?._tag ?? "Empty"}`;
	let message = Cause.pretty(cause);
	let status: NumericRange<300, 599> = 500;
	let extra: Record<string, unknown> = {};

	const report = (details: Record<string, unknown>) => {
		Effect.runFork(AppLog.error(labelMessage(message, remote), remote ? { ...details, remote } : details));
	};

	if (reason && Cause.isFailReason(reason)) {
		const error = reason.error;

		name = error._tag;
		status = "status" in error ? error.status : 500;
		extra.cause = error.cause;
		extra = Object.assign(
			extra,
			isTaggedError(error)
				? omit(error, ["_tag", "_op", "pipe", "name", "message", "status"])
				: omit(error, ["_tag", "pipe", "name", "message"])
		);

		report(extra);
	}

	if (reason && Cause.isDieReason(reason)) {
		const defect = reason.defect;
		name = "UnknownDefect";
		extra.defect = defect;

		if (isRedirect(defect)) {
			name = "Redirect";
			message = `Redirect to ${defect.location}`;
			status = defect.status;
			extra.redirectTo = defect.location;
		} else if (isHttpError(defect)) {
			name = "HttpError";
			status = defect.status as NumericRange<300, 599>;
			message = defect.body.message;
		} else if (defect instanceof Error) {
			name = defect.name;
		}

		if (typeof defect === "object" && defect !== null) {
			if ("name" in defect && typeof defect.name === "string") {
				name = defect.name;
			}
			if ("stack" in defect) {
				extra.stack = defect.stack;
			}
			if ("status" in defect && typeof defect.status === "number") {
				status = defect.status as NumericRange<300, 599>;
			}
			if ("message" in defect && typeof defect.message === "string") {
				message = defect.message;
				report(extra);
			}
		}
	}

	const trace = getTrace(message);
	const failure: EffectError = {
		name,
		type: reason?._tag ?? "Empty",
		message: trace.message,
		stack: trace.stack,
		status
	};
	return Object.assign(failure, extra);
}
