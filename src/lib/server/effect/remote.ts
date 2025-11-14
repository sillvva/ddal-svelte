import { command, form, query } from "$app/server";
import type { LocalsUser } from "$lib/schemas";
import { AuthService } from "$lib/server/effect/services/auth";
import { isRedirectFailure, isStandardSchema, isValidationError } from "$lib/util";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import {
	redirect,
	type Invalid,
	type RemoteCommand,
	type RemoteForm,
	type RemoteFormInput,
	type RemoteQueryFunction,
	type RequestEvent
} from "@sveltejs/kit";
import { Effect } from "effect";
import { isFunction, isString } from "effect/Predicate";
import type { YieldWrap } from "effect/Utils";
import type { ErrorClass } from "./errors";
import { run, runSafe, type EffectResult, type Services } from "./runtime";

// -------------------------------------------------------------------------------------------------
// guardedQuery: Remote Query with auth guard
// -------------------------------------------------------------------------------------------------

export function guardedQuery<
	Schema extends StandardSchemaV1,
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(
	schema: Schema,
	fn: (output: StandardSchemaV1.InferOutput<Schema>, auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X>,
	adminOnly?: boolean
): RemoteQueryFunction<StandardSchemaV1.InferInput<Schema>, X>;

export function guardedQuery<
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(fn: (auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X>, adminOnly?: boolean): RemoteQueryFunction<void, X>;

export function guardedQuery<
	Schema extends StandardSchemaV1,
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(
	schemaOrFn: Schema | ((auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X>),
	fnOrAdminOnly?:
		| ((output: StandardSchemaV1.InferOutput<Schema>, auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X>)
		| boolean,
	adminOnly = false
) {
	// Handle the case with schema parameter (first overload)
	if (isStandardSchema(schemaOrFn) && isFunction(fnOrAdminOnly)) {
		return query(schemaOrFn, (output) =>
			run(function* () {
				const Auth = yield* AuthService;
				const auth = yield* Auth.guard(adminOnly);
				return yield* fnOrAdminOnly(output, auth);
			})
		);
	}

	// Handle the case where there's no schema parameter (second overload)
	if (isFunction(schemaOrFn) && !isFunction(fnOrAdminOnly)) {
		return query(() =>
			run(function* () {
				const Auth = yield* AuthService;
				const auth = yield* Auth.guard(fnOrAdminOnly);
				return yield* schemaOrFn(auth);
			})
		);
	}

	throw new Error("Invalid arguments");
}

// -------------------------------------------------------------------------------------------------
// guardedCommand: Remote Command with auth guard
// -------------------------------------------------------------------------------------------------

export function guardedCommand<
	Schema extends StandardSchemaV1,
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(
	schema: Schema,
	fn: (output: StandardSchemaV1.InferOutput<Schema>, auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X>,
	adminOnly?: boolean
): RemoteCommand<StandardSchemaV1.InferInput<Schema>, Promise<EffectResult<X>>>;

export function guardedCommand<
	Input,
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(
	fn: (input: Input, auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X>,
	adminOnly?: boolean
): RemoteCommand<Input, Promise<EffectResult<X>>>;

export function guardedCommand<
	Schema extends StandardSchemaV1,
	Input,
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(
	schemaOrFn: Schema | ((input: Input, auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X>),
	fnOrAdminOnly?:
		| ((output: StandardSchemaV1.InferOutput<Schema>, auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X>)
		| boolean,
	adminOnly = false
) {
	// Handle the case with schema parameter (first overload)
	if (isStandardSchema(schemaOrFn) && isFunction(fnOrAdminOnly)) {
		return command(schemaOrFn, (output) =>
			runSafe(function* () {
				const Auth = yield* AuthService;
				const auth = yield* Auth.guard(adminOnly);
				return yield* fnOrAdminOnly(output, auth);
			})
		);
	}

	// Handle the case where there's no schema parameter (second overload)
	if (isFunction(schemaOrFn) && !isFunction(fnOrAdminOnly)) {
		return command("unchecked", (input: Input) =>
			runSafe(function* () {
				const Auth = yield* AuthService;
				const auth = yield* Auth.guard(fnOrAdminOnly);
				return yield* schemaOrFn(input, auth);
			})
		);
	}

	throw new Error("Invalid arguments");
}

// -------------------------------------------------------------------------------------------------
// guardedForm: Remote Form with auth guard
// -------------------------------------------------------------------------------------------------

export function guardedForm<
	Schema extends StandardSchemaV1<RemoteFormInput, Record<string, unknown>>,
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(
	schema: Schema,
	fn: (
		output: StandardSchemaV1.InferOutput<Schema>,
		auth: { user: LocalsUser; event: RequestEvent; invalid: Invalid<StandardSchemaV1.InferInput<Schema>> }
	) => Generator<T, X>,
	adminOnly?: boolean
): RemoteForm<StandardSchemaV1.InferInput<Schema>, X>;

export function guardedForm<
	Input extends RemoteFormInput,
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(
	schema: "unchecked",
	fn: (input: Input, auth: { user: LocalsUser; event: RequestEvent; invalid: Invalid<Input> }) => Generator<T, X>,
	adminOnly?: boolean
): RemoteForm<Input, X>;

export function guardedForm<
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(
	fn: (auth: { user: LocalsUser; event: RequestEvent; invalid: Invalid<void> }) => Generator<T, X>,
	adminOnly?: boolean
): RemoteForm<void, X>;

export function guardedForm<
	Schema extends StandardSchemaV1<RemoteFormInput, Record<string, unknown>>,
	Input extends RemoteFormInput,
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(
	schemaOrFn:
		| Schema
		| "unchecked"
		| ((auth: { user: LocalsUser; event: RequestEvent; invalid: Invalid<void> }) => Generator<T, X>),
	fnOrAdminOnly?:
		| ((
				output: StandardSchemaV1.InferOutput<Schema>,
				auth: { user: LocalsUser; event: RequestEvent; invalid: Invalid<StandardSchemaV1.InferInput<Schema>> }
		  ) => Generator<T, X>)
		| ((input: Input, auth: { user: LocalsUser; event: RequestEvent; invalid: Invalid<Input> }) => Generator<T, X>)
		| boolean,
	adminOnly = false
) {
	function parseResult(result: EffectResult<X>, invalid: Invalid<unknown>) {
		if (result.ok) return result.data;
		if (isRedirectFailure(result.error)) redirect(result.error.status, result.error.redirectTo);
		if (isValidationError(result.error)) throw result.error.defect;
		throw invalid(result.error.message);
	}

	// Handle the case with schema parameter (first overload)
	if (isStandardSchema(schemaOrFn) && isFunction(fnOrAdminOnly)) {
		const fn = fnOrAdminOnly as (
			output: StandardSchemaV1.InferOutput<Schema>,
			auth: { user: LocalsUser; event: RequestEvent; invalid: Invalid<StandardSchemaV1.InferInput<Schema>> }
		) => Generator<T, X>;
		return form(schemaOrFn, async (output, invalid) => {
			const result = await runSafe(function* () {
				const Auth = yield* AuthService;
				const auth = yield* Auth.guard(adminOnly);
				return yield* fn(output, { invalid, ...auth });
			});

			return parseResult(result, invalid);
		});
	}

	// Handle the case where there's no schema parameter (second overload)
	if (isString(schemaOrFn) && isFunction(fnOrAdminOnly)) {
		const fn = fnOrAdminOnly as (
			input: Input,
			auth: { user: LocalsUser; event: RequestEvent; invalid: Invalid<Input> }
		) => Generator<T, X>;
		return form(schemaOrFn, async (input: Input, invalid) => {
			const result = await runSafe(function* () {
				const Auth = yield* AuthService;
				const auth = yield* Auth.guard(adminOnly);
				return yield* fn(input, { invalid, ...auth });
			});

			return parseResult(result, invalid);
		});
	}

	// Handle the case where there's no schema parameter (third overload)
	if (isFunction(schemaOrFn) && !isFunction(fnOrAdminOnly)) {
		return form(async (invalid) => {
			const result = await runSafe(function* () {
				const Auth = yield* AuthService;
				const auth = yield* Auth.guard(fnOrAdminOnly);
				return yield* schemaOrFn({ invalid, ...auth });
			});

			return parseResult(result, invalid);
		});
	}

	throw new Error("Invalid arguments");
}

// -------------------------------------------------------------------------------------------------
// refreshAll: Refresh all queries
// -------------------------------------------------------------------------------------------------

export const refreshAll = Effect.fn(function* (...queries: Promise<void>[]) {
	return yield* Effect.promise(() => Promise.all(queries));
});
