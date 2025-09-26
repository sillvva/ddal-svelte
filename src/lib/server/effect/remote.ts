import { command, query } from "$app/server";
import type { LocalsUser } from "$lib/schemas";
import { assertAuth } from "$lib/server/effect/services/auth";
import type { RemoteCommand, RemoteQueryFunction, RequestEvent } from "@sveltejs/kit";
import { Effect } from "effect";
import type { YieldWrap } from "effect/Utils";
import * as v from "valibot";
import type { ErrorClass } from "./errors";
import { run, runSafe, type EffectResult, type Services } from "./runtime";

// -------------------------------------------------------------------------------------------------
// guardedQuery: Remote Query with auth guard
// -------------------------------------------------------------------------------------------------

export function guardedQuery<
	Schema extends v.GenericSchema,
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X,
	Y
>(
	schema: Schema,
	fn: (output: v.InferOutput<Schema>, auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X, Y>,
	adminOnly?: boolean
): RemoteQueryFunction<v.InferInput<Schema>, X>;

export function guardedQuery<
	Input,
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X,
	Y
>(
	schema: "unchecked",
	fn: (input: Input, auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X, Y>,
	adminOnly?: boolean
): RemoteQueryFunction<Input, X>;

export function guardedQuery<
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X,
	Y
>(fn: (auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X, Y>, adminOnly?: boolean): RemoteQueryFunction<void, X>;

export function guardedQuery(schemaOrFn: any, fnOrAdminOnly: any, adminOnly = false) {
	// Handle the case where there's no schema parameter (third overload)
	if (typeof schemaOrFn === "function") {
		return query(() =>
			run(function* () {
				const auth = yield* assertAuth(fnOrAdminOnly);
				return yield* schemaOrFn(auth);
			})
		);
	}

	// Handle the case with schema parameter (first and second overload)
	return query(schemaOrFn, (output) =>
		run(function* () {
			const auth = yield* assertAuth(adminOnly);
			return yield* fnOrAdminOnly(output, auth);
		})
	);
}

// -------------------------------------------------------------------------------------------------
// guardedCommand: Remote Command with auth guard
// -------------------------------------------------------------------------------------------------

export function guardedCommand<
	Schema extends v.GenericSchema,
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X,
	Y
>(
	schema: Schema,
	fn: (output: v.InferOutput<Schema>, auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X, Y>,
	adminOnly?: boolean
): RemoteCommand<v.InferInput<Schema>, Promise<EffectResult<X>>>;

export function guardedCommand<
	Input,
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X,
	Y
>(
	fn: (input: Input, auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X, Y>,
	adminOnly?: boolean
): RemoteCommand<Input, Promise<EffectResult<X>>>;

export function guardedCommand(schemaOrFn: any, fnOrAdminOnly: any, adminOnly = false) {
	// Handle the case where there's no schema parameter (second overload)
	if (typeof schemaOrFn === "function") {
		return command("unchecked", (input) =>
			runSafe(function* () {
				const auth = yield* assertAuth(fnOrAdminOnly);
				return yield* schemaOrFn(input, auth);
			})
		);
	}

	// Handle the case with schema parameter (first overload)
	return command(schemaOrFn, (output) =>
		runSafe(function* () {
			const auth = yield* assertAuth(adminOnly);
			return yield* fnOrAdminOnly(output, auth);
		})
	);
}
