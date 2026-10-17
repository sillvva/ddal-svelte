import type { LocalsUser } from "#lib/schemas.js";
import { AuthService, type GuardAccess } from "#lib/server/effect/services/auth.js";
import { isRedirectFailure, isStandardSchema, isValidationError, type IsAny } from "#lib/util.js";
import {
	command,
	form,
	query,
	type RemoteCommand,
	type RemoteForm,
	type RemoteFormInput,
	type RemoteFormInvalidField,
	type RemoteQueryFunction
} from "$app/server";
import { isFunction, isString, omit } from "@sillvva/utils";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { invalid, redirect, type RequestEvent } from "@sveltejs/kit";
import { Cause, Effect } from "effect";
import type { ErrorClass } from "./errors";
import { captureRemoteSource, remoteLabel } from "./remote-label.js";
import { run, runSafe, type ClientEffectResult, type EffectResult, type Services } from "./runtime";

// -------------------------------------------------------------------------------------------------
// Shared types
// -------------------------------------------------------------------------------------------------

type AppError = InstanceType<ErrorClass> | Cause.UnknownError;

type Auth = { user: LocalsUser; event: RequestEvent };

type FormAuth<Input> = Auth & { issue: RemoteFormInvalidField<Input> };

/**
 * Generator passed to a guarded remote function.
 * `Y` is inferred from the yielded effects so mixed `yield*` types stay intact.
 * `E` and `R` stay in the constraint so every failure is an app error and every
 * requirement is an app service.
 */
type AppGen<A, E extends AppError, R extends Services, Y extends Effect.Effect<unknown, E, R>> = Generator<Y, A>;

function stripStack<A>(result: EffectResult<A>): ClientEffectResult<A> {
	if (result.ok) return result;
	return { ok: false, error: omit(result.error, ["stack"]) };
}

/** Remember the `*.remote.ts` caller, then read SvelteKit's export name when the function runs. */
function bindRemote<T extends object>(create: (label: () => string | undefined) => T): T {
	const source = captureRemoteSource();
	const box: { current?: object } = {};
	const created = create(() => remoteLabel(box.current, source));
	box.current = created;
	return created;
}

function authed<A>(
	access: GuardAccess,
	body: (auth: Auth) => AppGen<A, AppError, Services, Effect.Effect<unknown, AppError, Services>>
) {
	return Effect.gen(function* () {
		const Auth = yield* AuthService;
		const auth = yield* Auth.guard(access);
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
	Y extends Effect.Effect<unknown, E, R>
>(
	schema: Schema,
	fn: (output: StandardSchemaV1.InferOutput<Schema>, auth: Auth) => AppGen<A, E, R, Y>,
	access?: GuardAccess
): RemoteQueryFunction<StandardSchemaV1.InferInput<Schema>, A>;

export function guardedQuery<A, E extends AppError, R extends Services, Y extends Effect.Effect<unknown, E, R>>(
	fn: (auth: Auth) => AppGen<A, E, R, Y>,
	access?: GuardAccess
): RemoteQueryFunction<void, A>;

export function guardedQuery<
	Schema extends StandardSchemaV1,
	A,
	E extends AppError,
	R extends Services,
	Y extends Effect.Effect<unknown, E, R>
>(
	schemaOrFn: Schema | ((auth: Auth) => AppGen<A, E, R, Y>),
	fnOrAccess?: ((output: StandardSchemaV1.InferOutput<Schema>, auth: Auth) => AppGen<A, E, R, Y>) | GuardAccess,
	access: GuardAccess = null
) {
	// Handle the case with schema parameter (first overload)
	if (isStandardSchema(schemaOrFn) && isFunction(fnOrAccess)) {
		return bindRemote((label) =>
			query(schemaOrFn, (output) => run(authed(access, (auth) => fnOrAccess(output, auth)), { remote: label() }))
		);
	}

	// Handle the case where there's no schema parameter (second overload)
	if (isFunction(schemaOrFn) && !isFunction(fnOrAccess)) {
		return bindRemote((label) => query(() => run(authed(fnOrAccess ?? null, (auth) => schemaOrFn(auth)), { remote: label() })));
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
	Y extends Effect.Effect<unknown, E, R>
>(
	schema: Schema,
	fn: (output: StandardSchemaV1.InferOutput<Schema>, auth: Auth) => AppGen<A, E, R, Y>,
	access?: GuardAccess
): RemoteCommand<StandardSchemaV1.InferInput<Schema>, ClientEffectResult<A>>;

export function guardedCommand<Input, A, E extends AppError, R extends Services, Y extends Effect.Effect<unknown, E, R>>(
	fn: (input: Input, auth: Auth) => AppGen<A, E, R, Y>,
	access?: GuardAccess
): RemoteCommand<Input, ClientEffectResult<A>>;

export function guardedCommand<
	Schema extends StandardSchemaV1,
	Input,
	A,
	E extends AppError,
	R extends Services,
	Y extends Effect.Effect<unknown, E, R>
>(
	schemaOrFn: Schema | ((input: Input, auth: Auth) => AppGen<A, E, R, Y>),
	fnOrAccess?: ((output: StandardSchemaV1.InferOutput<Schema>, auth: Auth) => AppGen<A, E, R, Y>) | GuardAccess,
	access: GuardAccess = null
) {
	// Handle the case with schema parameter (first overload)
	if (isStandardSchema(schemaOrFn) && isFunction(fnOrAccess)) {
		return bindRemote((label) =>
			command(schemaOrFn, async (output) => {
				const result = await runSafe(authed(access, (auth) => fnOrAccess(output, auth)), { remote: label() });
				return stripStack(result);
			})
		);
	}

	// Handle the case where there's no schema parameter (second overload)
	if (isFunction(schemaOrFn) && !isFunction(fnOrAccess)) {
		return bindRemote((label) =>
			command("unchecked", async (input: Input) => {
				const result = await runSafe(authed(fnOrAccess ?? null, (auth) => schemaOrFn(input, auth)), { remote: label() });
				return stripStack(result);
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
				: T extends Record<string, unknown>
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
	fn: (
		data: StandardSchemaV1.InferOutput<Schema>,
		issue: RemoteFormInvalidField<StandardSchemaV1.InferInput<Schema>>
	) => Awaitable<Output>
) => RemoteForm<StandardSchemaV1.InferInput<Schema>, Output>;

export function guardedForm<
	Schema extends StandardSchemaV1<RemoteFormInput, Record<string, unknown>>,
	A,
	E extends AppError,
	R extends Services,
	Y extends Effect.Effect<unknown, E, R>
>(
	schema: FormSchemaValidate<Schema>,
	fn: (output: StandardSchemaV1.InferOutput<Schema>, auth: FormAuth<StandardSchemaV1.InferInput<Schema>>) => AppGen<A, E, R, Y>,
	access?: GuardAccess
): RemoteForm<StandardSchemaV1.InferInput<Schema>, A>;

export function guardedForm<
	Input extends RemoteFormInput,
	A,
	E extends AppError,
	R extends Services,
	Y extends Effect.Effect<unknown, E, R>
>(
	schema: "unchecked",
	fn: (input: Input, auth: FormAuth<Input>) => AppGen<A, E, R, Y>,
	access?: GuardAccess
): RemoteForm<Input, A>;

export function guardedForm<A, E extends AppError, R extends Services, Y extends Effect.Effect<unknown, E, R>>(
	fn: (auth: Auth) => AppGen<A, E, R, Y>,
	access?: GuardAccess
): RemoteForm<void, A>;

export function guardedForm<
	Schema extends StandardSchemaV1<RemoteFormInput, Record<string, unknown>>,
	Input extends RemoteFormInput,
	A,
	E extends AppError,
	R extends Services,
	Y extends Effect.Effect<unknown, E, R>
>(
	schemaOrFn: FormSchemaValidate<Schema> | "unchecked" | ((auth: Auth) => AppGen<A, E, R, Y>),
	fnOrAccess?:
		| ((output: StandardSchemaV1.InferOutput<Schema>, auth: FormAuth<StandardSchemaV1.InferInput<Schema>>) => AppGen<A, E, R, Y>)
		| ((input: Input, auth: FormAuth<Input>) => AppGen<A, E, R, Y>)
		| GuardAccess,
	access: GuardAccess = null
) {
	function parseResult(result: EffectResult<A>) {
		if (result.ok) return result.data;
		if (isRedirectFailure(result.error)) redirect(result.error.status, result.error.redirectTo);
		if (isValidationError(result.error)) throw result.error.defect;
		throw invalid(result.error.message);
	}

	// Handle the case with schema parameter (first overload)
	if (isFormSchema<Schema>(schemaOrFn) && isFunction(fnOrAccess)) {
		const fn = fnOrAccess as (
			output: StandardSchemaV1.InferOutput<Schema>,
			auth: FormAuth<StandardSchemaV1.InferInput<Schema>>
		) => AppGen<A, E, R, Y>;
		return bindRemote((label) =>
			formWithSchema(schemaOrFn, async (output, issue) => {
				const result = await runSafe(authed(access, (auth) => fn(output, { issue, ...auth })), { remote: label() });
				return parseResult(result);
			})
		);
	}

	// Handle the case where there's no schema parameter (second overload)
	if (isString(schemaOrFn) && isFunction(fnOrAccess)) {
		const fn = fnOrAccess as (input: Input, auth: FormAuth<Input>) => AppGen<A, E, R, Y>;
		return bindRemote((label) =>
			form("unchecked", async (input: Input, issue) => {
				const result = await runSafe(authed(access, (auth) => fn(input, { issue, ...auth })), { remote: label() });
				return parseResult(result);
			})
		);
	}

	// Handle the case where there's no schema parameter (third overload)
	if (isFunction(schemaOrFn) && !isFunction(fnOrAccess)) {
		return bindRemote((label) =>
			form(async () => {
				const result = await runSafe(authed(fnOrAccess ?? null, (auth) => schemaOrFn({ ...auth })), { remote: label() });
				return parseResult(result);
			})
		);
	}

	throw new Error("Invalid arguments");
}

// -------------------------------------------------------------------------------------------------
// refreshAll: Refresh all queries
// -------------------------------------------------------------------------------------------------

export const refreshAll = Effect.fn(function* (...queries: Promise<void>[]) {
	return yield* Effect.tryPromise(() => Promise.all(queries));
});
