import { command, query } from "$app/server";
import type { LocalsUser } from "$lib/schemas";
import { assertAuth } from "$lib/server/effect/services/auth";
import { type RemoteCommand, type RemoteQueryFunction, type RequestEvent } from "@sveltejs/kit";
import { Effect } from "effect";
import type { YieldWrap } from "effect/Utils";
import * as v from "valibot";
import { type ErrorClass } from "./errors";
import { run, runSafe, type Services } from "./runtime";

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
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X,
	Y,
	Input
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

export function guardedQuery(schema: any, fn: any, adminOnly = false) {
	// Handle the case where there's no schema parameter (third overload)
	if (typeof schema === "function") {
		return query(() =>
			run(function* () {
				const auth = yield* assertAuth(fn /*adminOnly*/);
				return yield* schema(/*fn*/ auth);
			})
		);
	}

	// Handle the case with schema parameter (first and second overload)
	return query(schema, (output) =>
		run(function* () {
			const auth = yield* assertAuth(adminOnly);
			return yield* fn(output, auth);
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
): RemoteCommand<v.InferInput<Schema>, X>;

export function guardedCommand<
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X,
	Y,
	Input
>(
	fn: (input: Input, auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X, Y>,
	adminOnly?: boolean
): RemoteCommand<Input, X>;

export function guardedCommand(schema: any, fn: any, adminOnly = false) {
	// Handle the case where there's no schema parameter (second overload)
	if (typeof schema === "function") {
		return command("unchecked", (input) =>
			runSafe(function* () {
				const auth = yield* assertAuth(fn /*adminOnly*/);
				return yield* schema(/*fn*/ input, auth);
			})
		);
	}

	// Handle the case with schema parameter (first overload)
	return command(schema, (output) =>
		runSafe(function* () {
			const auth = yield* assertAuth(adminOnly);
			return yield* fn(output, auth);
		})
	);
}
