import { command, form, query } from "$app/server";
import type { LocalsUser } from "$lib/schemas";
import { AuthService } from "$lib/server/effect/services/auth";
import { isRedirectFailure, isStandardSchema, isValidationError, type IsAny } from "$lib/util";
import { isFunction, isString } from "@sillvva/utils";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import {
	invalid,
	redirect,
	type InvalidField,
	type RemoteCommand,
	type RemoteForm,
	type RemoteFormInput,
	type RemoteQueryFunction,
	type RequestEvent
} from "@sveltejs/kit";
import { Effect } from "effect";
import type { UnknownException } from "effect/Cause";
import type { YieldWrap } from "effect/Utils";
import type { ErrorClass } from "./errors";
import { run, runSafe, type EffectResult, type Services } from "./runtime";

// -------------------------------------------------------------------------------------------------
// guardedQuery: Remote Query with auth guard
// -------------------------------------------------------------------------------------------------

export function guardedQuery<
	Schema extends StandardSchemaV1,
	R,
	F extends InstanceType<ErrorClass> | UnknownException,
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
	F extends InstanceType<ErrorClass> | UnknownException,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(fn: (auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X>, adminOnly?: boolean): RemoteQueryFunction<void, X>;

export function guardedQuery<
	Schema extends StandardSchemaV1,
	R,
	F extends InstanceType<ErrorClass> | UnknownException,
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
	F extends InstanceType<ErrorClass> | UnknownException,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(
	schema: Schema,
	fn: (output: StandardSchemaV1.InferOutput<Schema>, auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X>,
	adminOnly?: boolean
): RemoteCommand<StandardSchemaV1.InferInput<Schema>, EffectResult<X>>;

export function guardedCommand<
	Input,
	R,
	F extends InstanceType<ErrorClass> | UnknownException,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(
	fn: (input: Input, auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X>,
	adminOnly?: boolean
): RemoteCommand<Input, EffectResult<X>>;

export function guardedCommand<
	Schema extends StandardSchemaV1,
	Input,
	R,
	F extends InstanceType<ErrorClass> | UnknownException,
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

type HasNonOptionalBoolean<T> =
	IsAny<T> extends true
		? never
		: [T] extends [boolean]
			? true
			: T extends Array<infer U>
				? HasNonOptionalBoolean<U>
				: T extends Record<string, any>
					? { [K in keyof T]: HasNonOptionalBoolean<T[K]> }[keyof T]
					: never;

type FormSchemaValidate<Schema extends StandardSchemaV1<RemoteFormInput, Record<string, unknown>>> =
	true extends HasNonOptionalBoolean<StandardSchemaV1.InferInput<Schema>>
		? "Error: All booleans in form schemas must be optional (e.g. `v.optional(v.boolean(), false)`) because checkbox inputs do not send a false value when unchecked."
		: Schema;

export function guardedForm<
	Schema extends StandardSchemaV1<RemoteFormInput, Record<string, unknown>>,
	R,
	F extends InstanceType<ErrorClass> | UnknownException,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(
	schema: FormSchemaValidate<Schema>,
	fn: (
		output: StandardSchemaV1.InferOutput<Schema>,
		auth: { user: LocalsUser; event: RequestEvent; issue: InvalidField<StandardSchemaV1.InferInput<Schema>> }
	) => Generator<T, X>,
	adminOnly?: boolean
): RemoteForm<StandardSchemaV1.InferInput<Schema>, X>;

export function guardedForm<
	Input extends RemoteFormInput,
	R,
	F extends InstanceType<ErrorClass> | UnknownException,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(
	schema: "unchecked",
	fn: (input: Input, auth: { user: LocalsUser; event: RequestEvent; issue: InvalidField<Input> }) => Generator<T, X>,
	adminOnly?: boolean
): RemoteForm<Input, X>;

export function guardedForm<
	R,
	F extends InstanceType<ErrorClass> | UnknownException,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(
	fn: (auth: { user: LocalsUser; event: RequestEvent; issue: InvalidField<void> }) => Generator<T, X>,
	adminOnly?: boolean
): RemoteForm<void, X>;

export function guardedForm<
	Schema extends StandardSchemaV1<RemoteFormInput, Record<string, unknown>>,
	Input extends RemoteFormInput,
	R,
	F extends InstanceType<ErrorClass> | UnknownException,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(
	schemaOrFn: FormSchemaValidate<Schema> | "unchecked" | ((auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X>),
	fnOrAdminOnly?:
		| ((
				output: StandardSchemaV1.InferOutput<Schema>,
				auth: { user: LocalsUser; event: RequestEvent; issue: InvalidField<StandardSchemaV1.InferInput<Schema>> }
		  ) => Generator<T, X>)
		| ((input: Input, auth: { user: LocalsUser; event: RequestEvent; issue: InvalidField<Input> }) => Generator<T, X>)
		| boolean,
	adminOnly = false
) {
	function parseResult(result: EffectResult<X>) {
		if (result.ok) return result.data;
		if (isRedirectFailure(result.error)) redirect(result.error.status, result.error.redirectTo);
		if (isValidationError(result.error)) throw result.error.defect;
		throw invalid(result.error.message);
	}

	// Handle the case with schema parameter (first overload)
	if (isStandardSchema(schemaOrFn) && isFunction(fnOrAdminOnly)) {
		const fn = fnOrAdminOnly as (
			output: StandardSchemaV1.InferOutput<Schema>,
			auth: { user: LocalsUser; event: RequestEvent; issue: InvalidField<StandardSchemaV1.InferInput<Schema>> }
		) => Generator<T, X>;
		return form(schemaOrFn as any, async (output, issue: InvalidField<StandardSchemaV1.InferInput<Schema>>) => {
			const result = await runSafe(function* () {
				const Auth = yield* AuthService;
				const auth = yield* Auth.guard(adminOnly);
				return yield* fn(output, { issue, ...auth });
			});

			return parseResult(result);
		});
	}

	// Handle the case where there's no schema parameter (second overload)
	if (isString(schemaOrFn) && isFunction(fnOrAdminOnly)) {
		const fn = fnOrAdminOnly as (
			input: Input,
			auth: { user: LocalsUser; event: RequestEvent; issue: InvalidField<Input> }
		) => Generator<T, X>;
		return form("unchecked", async (input: Input, issue: InvalidField<Input>) => {
			const result = await runSafe(function* () {
				const Auth = yield* AuthService;
				const auth = yield* Auth.guard(adminOnly);
				return yield* fn(input, { issue, ...auth });
			});

			return parseResult(result);
		});
	}

	// Handle the case where there's no schema parameter (third overload)
	if (isFunction(schemaOrFn) && !isFunction(fnOrAdminOnly)) {
		return form(async () => {
			const result = await runSafe(function* () {
				const Auth = yield* AuthService;
				const auth = yield* Auth.guard(fnOrAdminOnly);
				return yield* schemaOrFn({ ...auth });
			});

			return parseResult(result);
		});
	}

	throw new Error("Invalid arguments");
}

// -------------------------------------------------------------------------------------------------
// refreshAll: Refresh all queries
// -------------------------------------------------------------------------------------------------

export const refreshAll = Effect.fn(function* (...queries: Promise<void>[]) {
	return yield* Effect.tryPromise(() => Promise.all(queries));
});
