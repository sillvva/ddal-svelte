import { command, form, query } from "$app/server";
import type { LocalsUser } from "$lib/schemas";
import { AuthService } from "$lib/server/effect/services/auth";
import { isRedirectFailure, isStandardSchema, isValidationError, type IsAny } from "$lib/util";
import { isFunction, isString, omit } from "@sillvva/utils";
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
import { run, runSafe, type ClientEffectResult, type EffectResult, type Services } from "./runtime";

// -------------------------------------------------------------------------------------------------
// Shared types
// -------------------------------------------------------------------------------------------------

type AppError = InstanceType<ErrorClass> | UnknownException;

type Auth = { user: LocalsUser; event: RequestEvent };

type FormAuth<Input> = Auth & { issue: InvalidField<Input> };

/**
 * Generator passed to a guarded remote function.
 * `Y` is inferred from the yielded effects so mixed `yield*` types stay intact.
 * `E` and `R` stay in the constraint so every failure is an app error and every
 * requirement is an app service.
 */
type AppGen<A, E extends AppError, R extends Services, Y extends YieldWrap<Effect.Effect<unknown, E, R>>> = Generator<Y, A>;

function stripStack<A>(result: EffectResult<A>): ClientEffectResult<A> {
	if (result.ok) return result;
	return { ok: false, error: omit(result.error, ["stack"]) };
}

function authed<A>(
	adminOnly: boolean,
	body: (auth: Auth) => AppGen<A, AppError, Services, YieldWrap<Effect.Effect<unknown, AppError, Services>>>
) {
	return Effect.gen(function* () {
		const Auth = yield* AuthService;
		const auth = yield* Auth.guard(adminOnly);
		return yield* body(auth);
	});
}

// -------------------------------------------------------------------------------------------------
// guardedQuery: Remote Query with auth guard
// -------------------------------------------------------------------------------------------------

export function guardedQuery<
	Schema extends StandardSchemaV1,
	A,
	E extends AppError,
	R extends Services,
	Y extends YieldWrap<Effect.Effect<unknown, E, R>>
>(
	schema: Schema,
	fn: (output: StandardSchemaV1.InferOutput<Schema>, auth: Auth) => AppGen<A, E, R, Y>,
	adminOnly?: boolean
): RemoteQueryFunction<StandardSchemaV1.InferInput<Schema>, A>;

export function guardedQuery<A, E extends AppError, R extends Services, Y extends YieldWrap<Effect.Effect<unknown, E, R>>>(
	fn: (auth: Auth) => AppGen<A, E, R, Y>,
	adminOnly?: boolean
): RemoteQueryFunction<void, A>;

export function guardedQuery<
	Schema extends StandardSchemaV1,
	A,
	E extends AppError,
	R extends Services,
	Y extends YieldWrap<Effect.Effect<unknown, E, R>>
>(
	schemaOrFn: Schema | ((auth: Auth) => AppGen<A, E, R, Y>),
	fnOrAdminOnly?: ((output: StandardSchemaV1.InferOutput<Schema>, auth: Auth) => AppGen<A, E, R, Y>) | boolean,
	adminOnly = false
) {
	// Handle the case with schema parameter (first overload)
	if (isStandardSchema(schemaOrFn) && isFunction(fnOrAdminOnly)) {
		return query(schemaOrFn, (output) => run(authed(adminOnly, (auth) => fnOrAdminOnly(output, auth))));
	}

	// Handle the case where there's no schema parameter (second overload)
	if (isFunction(schemaOrFn) && !isFunction(fnOrAdminOnly)) {
		return query(() => run(authed(fnOrAdminOnly ?? false, (auth) => schemaOrFn(auth))));
	}

	throw new Error("Invalid arguments");
}

// -------------------------------------------------------------------------------------------------
// guardedCommand: Remote Command with auth guard
// -------------------------------------------------------------------------------------------------

export function guardedCommand<
	Schema extends StandardSchemaV1,
	A,
	E extends AppError,
	R extends Services,
	Y extends YieldWrap<Effect.Effect<unknown, E, R>>
>(
	schema: Schema,
	fn: (output: StandardSchemaV1.InferOutput<Schema>, auth: Auth) => AppGen<A, E, R, Y>,
	adminOnly?: boolean
): RemoteCommand<StandardSchemaV1.InferInput<Schema>, ClientEffectResult<A>>;

export function guardedCommand<
	Input,
	A,
	E extends AppError,
	R extends Services,
	Y extends YieldWrap<Effect.Effect<unknown, E, R>>
>(fn: (input: Input, auth: Auth) => AppGen<A, E, R, Y>, adminOnly?: boolean): RemoteCommand<Input, ClientEffectResult<A>>;

export function guardedCommand<
	Schema extends StandardSchemaV1,
	Input,
	A,
	E extends AppError,
	R extends Services,
	Y extends YieldWrap<Effect.Effect<unknown, E, R>>
>(
	schemaOrFn: Schema | ((input: Input, auth: Auth) => AppGen<A, E, R, Y>),
	fnOrAdminOnly?: ((output: StandardSchemaV1.InferOutput<Schema>, auth: Auth) => AppGen<A, E, R, Y>) | boolean,
	adminOnly = false
) {
	// Handle the case with schema parameter (first overload)
	if (isStandardSchema(schemaOrFn) && isFunction(fnOrAdminOnly)) {
		return command(schemaOrFn, async (output) => {
			const result = await runSafe(authed(adminOnly, (auth) => fnOrAdminOnly(output, auth)));
			return stripStack(result);
		});
	}

	// Handle the case where there's no schema parameter (second overload)
	if (isFunction(schemaOrFn) && !isFunction(fnOrAdminOnly)) {
		return command("unchecked", async (input: Input) => {
			const result = await runSafe(authed(fnOrAdminOnly ?? false, (auth) => schemaOrFn(input, auth)));
			return stripStack(result);
		});
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

function isFormSchema<Schema extends StandardSchemaV1<RemoteFormInput, Record<string, unknown>>>(
	schema: unknown
): schema is FormSchemaValidate<Schema> {
	return isStandardSchema(schema);
}

/** Kit's `form()` checkbox conditional does not unify with `FormSchemaValidate`, so the already-validated schema is passed through this signature. */
const formWithSchema = form as <Schema extends StandardSchemaV1<RemoteFormInput, Record<string, unknown>>, Output>(
	schema: FormSchemaValidate<Schema>,
	fn: (data: StandardSchemaV1.InferOutput<Schema>, issue: InvalidField<StandardSchemaV1.InferInput<Schema>>) => Awaitable<Output>
) => RemoteForm<StandardSchemaV1.InferInput<Schema>, Output>;

export function guardedForm<
	Schema extends StandardSchemaV1<RemoteFormInput, Record<string, unknown>>,
	A,
	E extends AppError,
	R extends Services,
	Y extends YieldWrap<Effect.Effect<unknown, E, R>>
>(
	schema: FormSchemaValidate<Schema>,
	fn: (output: StandardSchemaV1.InferOutput<Schema>, auth: FormAuth<StandardSchemaV1.InferInput<Schema>>) => AppGen<A, E, R, Y>,
	adminOnly?: boolean
): RemoteForm<StandardSchemaV1.InferInput<Schema>, A>;

export function guardedForm<
	Input extends RemoteFormInput,
	A,
	E extends AppError,
	R extends Services,
	Y extends YieldWrap<Effect.Effect<unknown, E, R>>
>(
	schema: "unchecked",
	fn: (input: Input, auth: FormAuth<Input>) => AppGen<A, E, R, Y>,
	adminOnly?: boolean
): RemoteForm<Input, A>;

export function guardedForm<A, E extends AppError, R extends Services, Y extends YieldWrap<Effect.Effect<unknown, E, R>>>(
	fn: (auth: Auth) => AppGen<A, E, R, Y>,
	adminOnly?: boolean
): RemoteForm<void, A>;

export function guardedForm<
	Schema extends StandardSchemaV1<RemoteFormInput, Record<string, unknown>>,
	Input extends RemoteFormInput,
	A,
	E extends AppError,
	R extends Services,
	Y extends YieldWrap<Effect.Effect<unknown, E, R>>
>(
	schemaOrFn: FormSchemaValidate<Schema> | "unchecked" | ((auth: Auth) => AppGen<A, E, R, Y>),
	fnOrAdminOnly?:
		| ((output: StandardSchemaV1.InferOutput<Schema>, auth: FormAuth<StandardSchemaV1.InferInput<Schema>>) => AppGen<A, E, R, Y>)
		| ((input: Input, auth: FormAuth<Input>) => AppGen<A, E, R, Y>)
		| boolean,
	adminOnly = false
) {
	function parseResult(result: EffectResult<A>) {
		if (result.ok) return result.data;
		if (isRedirectFailure(result.error)) redirect(result.error.status, result.error.redirectTo);
		if (isValidationError(result.error)) throw result.error.defect;
		throw invalid(result.error.message);
	}

	// Handle the case with schema parameter (first overload)
	if (isFormSchema<Schema>(schemaOrFn) && isFunction(fnOrAdminOnly)) {
		const fn = fnOrAdminOnly as (
			output: StandardSchemaV1.InferOutput<Schema>,
			auth: FormAuth<StandardSchemaV1.InferInput<Schema>>
		) => AppGen<A, E, R, Y>;
		return formWithSchema(schemaOrFn, async (output, issue) => {
			const result = await runSafe(authed(adminOnly, (auth) => fn(output, { issue, ...auth })));
			return parseResult(result);
		});
	}

	// Handle the case where there's no schema parameter (second overload)
	if (isString(schemaOrFn) && isFunction(fnOrAdminOnly)) {
		const fn = fnOrAdminOnly as (input: Input, auth: FormAuth<Input>) => AppGen<A, E, R, Y>;
		return form("unchecked", async (input: Input, issue) => {
			const result = await runSafe(authed(adminOnly, (auth) => fn(input, { issue, ...auth })));
			return parseResult(result);
		});
	}

	// Handle the case where there's no schema parameter (third overload)
	if (isFunction(schemaOrFn) && !isFunction(fnOrAdminOnly)) {
		return form(async () => {
			const result = await runSafe(authed(fnOrAdminOnly ?? false, (auth) => schemaOrFn({ ...auth })));
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
