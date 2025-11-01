# Effect.ts Integration with SvelteKit

This document provides a comprehensive overview of how Effect.ts has been integrated with SvelteKit in this project, covering the managed runtime, database service, run methods, command and query guards, and error logging.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Managed Runtime Setup](#managed-runtime-setup)
3. [Database Service Integration](#database-service-integration)
4. [Service Layer Architecture](#service-layer-architecture)
5. [Run Methods](#run-methods)
6. [Remote Function Guards](#remote-function-guards)
7. [Error Handling and Logging](#error-handling-and-logging)
8. [Schema Validation](#schema-validation)
9. [Usage Patterns](#usage-patterns)
10. [Best Practices](#best-practices)
11. [Additional Utilities](#additional-utilities)

## Architecture Overview

The Effect.ts integration follows a layered architecture pattern:

```
┌─────────────────────────────────────┐
│          SvelteKit Routes          │
├─────────────────────────────────────┤
│       Remote Queries/Commands      │
├─────────────────────────────────────┤
│           Effect Services          │
├─────────────────────────────────────┤
│           Database Layer           │
├─────────────────────────────────────┤
│           Managed Runtime          │
└─────────────────────────────────────┘
```

## Managed Runtime Setup

### Runtime Initialization

The managed runtime is created in `src/lib/server/effect/runtime.ts` using the `createAppRuntime` function:

```typescript
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
```

The runtime is instantiated once in `src/hooks.server.ts`:

```typescript
const appRuntime = createAppRuntime();
```

### Runtime Injection

The runtime is injected into every request through SvelteKit's `handle` function:

```typescript
const runtime: Handle = async ({ event, resolve }) => {
	event.locals.runtime = appRuntime;
	return await resolve(event);
};
```

This ensures that every request has access to the Effect runtime and can run Effect programs.

### Authentication Handler

An authentication handler runs Effect programs to fetch and validate user sessions:

```typescript
const authHandler: Handle = async ({ event, resolve }) =>
	run(function* () {
		const Auth = yield* AuthService;

		const { session, user, auth } = yield* Auth.getAuthSession();
		event.locals.session = session;
		event.locals.user = user;

		return svelteKitHandler({ event, resolve, auth, building });
	});
```

The handler is composed using SvelteKit's `sequence` function to ensure proper order of execution.

### Graceful Shutdown

The runtime includes proper cleanup on server shutdown through the `init` function:

```typescript
export const init: ServerInit = () => {
	if (globalThis.initialized) return;
	globalThis.initialized = true;

	const gracefulShutdown = async (signal: string) => {
		console.log("\nShut down signal received:", chalk.bold(signal));

		try {
			console.log("Disposing app runtime...");
			await appRuntime.dispose();
			console.log("Ending DB connection...");
			await DBService.end();
			console.log("Exiting process...");
			process.exit(0);
		} catch (err) {
			console.error("Error during cleanup:", err);
			process.exit(1);
		}
	};

	process.on("SIGINT", gracefulShutdown);
	process.on("SIGTERM", gracefulShutdown);
};
```

## Database Service Integration

### Database Service Definition

The `DBService` is defined as an Effect service that provides database access and transaction support:

```typescript
export class DBService extends Effect.Service<DBService>()("DBService", {
  effect: Effect.fn("DBService")(function* (tx?: Transaction) {
    const database = tx || db;

    const transaction = Effect.fn("DBService.transaction")(function* <A, B extends InstanceType<ErrorClass>>(
      effect: (tx: Transaction) => Effect.Effect<A, B | never>
    ) {
      const event = getRequestEvent();
      const runtime = event.locals.runtime;
      const result = yield* Effect.tryPromise({
        try: () =>
          database.transaction(async (tx) => {
            const result = await runtime.runPromiseExit(effect(tx));
            return Exit.match(result, {
              onSuccess: (value) => value,
              onFailure: (cause) => {
                throw Cause.isFailType(cause) ? cause.error : new TransactionError(cause);
              }
            });
          }),
        catch: (error) => {
          if (isTaggedError(error)) return error as B | TransactionError;
          return new TransactionError(Cause.fail(error));
        }
      });
      return result;
    });

    return { db: database, transaction };
  })
});
```

### Transaction Support

The database service provides Effect-based transaction support that integrates with the managed runtime:

- Transactions are run within the Effect runtime
- Proper error handling and cause propagation
- Support for both success and failure cases
- Integration with SvelteKit's request context
- Automatic rollback on errors

The transaction method wraps the Effect program and handles both tagged errors and unexpected defects:

```typescript
const transaction = Effect.fn("DBService.transaction")(function* <A, B extends InstanceType<ErrorClass>>(
	effect: (tx: Transaction) => Effect.Effect<A, B | never>
) {
	const event = getRequestEvent();
	const runtime = event.locals.runtime;
	const result = yield* Effect.tryPromise({
		try: () =>
			database.transaction(async (tx) => {
				const result = await runtime.runPromiseExit(effect(tx));
				return Exit.match(result, {
					onSuccess: (value) => value,
					onFailure: (cause) => {
						throw Cause.isFailType(cause) ? cause.error : new TransactionError(cause);
					}
				});
			}),
		catch: (error) => {
			if (isTaggedError(error)) return error as B | TransactionError;
			return new TransactionError(Cause.fail(error));
		}
	});
	return result;
});
```

### Query Execution

Database queries are wrapped in Effect for proper error handling:

```typescript
export function runQuery<T>(query: PromiseLike<T> & { toSQL: () => Query }) {
	return Effect.tryPromise({
		try: () => query,
		catch: (err) => new DrizzleError(err, query.toSQL())
	});
}
```

### Database Service Cleanup

The `DBService` class provides a static `end` method for graceful shutdown:

```typescript
static async end() {
	await connection.end();
}
```

This is called during the graceful shutdown process to properly close the database connection.

## Service Layer Architecture

### Service Definition Pattern

Services follow a consistent pattern using `Effect.Service`:

```typescript
export class CharacterService extends Effect.Service<CharacterService>()("CharacterService", {
  effect: Effect.fn("CharacterService")(function* () {
    const { db, transaction } = yield* DBService;

    const impl: CharacterApiImpl = {
      // Service implementation
    };

    return impl;
  }),
  dependencies: [DBService.Default()]
});
```

### Service Dependencies

Services declare their dependencies explicitly:

- `DBService` provides database access
- Services can depend on other services
- Dependencies are resolved through the managed runtime

### Service Interface Pattern

Services expose a structured API:

```typescript
interface CharacterApiImpl {
	readonly db: Database | Transaction;
	readonly get: {
		readonly character: (
			characterId: CharacterId,
			includeLogs?: boolean
		) => Effect.Effect<FullCharacterData, DrizzleError | CharacterNotFoundError>;
		readonly userCharacters: (
			userId: UserId,
			options?: { characterId?: CharacterId | null; includeLogs?: boolean }
		) => Effect.Effect<FullCharacterData[], DrizzleError>;
	};
	readonly set: {
		readonly save: (data: CharacterSchema, userId: UserId) => Effect.Effect<Character, SaveCharacterError | DrizzleError>;
		readonly delete: (
			characterId: CharacterId,
			userId: UserId
		) => Effect.Effect<{ id: CharacterId }, DeleteCharacterError | DrizzleError | TransactionError>;
	};
}
```

## Run Methods

### Main Run Function

The `run` function provides the primary way to execute Effect programs in the SvelteKit context. It supports multiple overloads for different program types:

```typescript
// Overload for generator functions
export async function run<
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(program: () => Generator<T, X>): Promise<X>;

// Overload for Effect or Effect factory functions
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
```

Note that `redirect()` and `error()` from SvelteKit never return (they throw), so the function will terminate execution at that point.

### Safe Run Function

The `runSafe` function provides error-safe execution that returns a result type instead of throwing. It also supports multiple overloads:

```typescript
// Overload for generator functions
export async function runSafe<
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(program: () => Generator<T, X>): Promise<EffectResult<X>>;

// Overload for Effect or Effect factory functions
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
```

#### EffectResult Type

The `EffectResult` type is a discriminated union that represents the outcome of an Effect program execution:

```typescript
export type EffectSuccess<R> = { ok: true; data: R };
export type EffectFailure = {
	ok: false;
	error: { message: string; stack: string; status: NumericRange<300, 599>; [key: string]: unknown };
};
export type EffectResult<R> = EffectSuccess<R> | EffectFailure;
```

- **`EffectSuccess<R>`**: Represents successful execution with the result data
- **`EffectFailure`**: Represents failed execution with error details including message, stack trace, HTTP status, and additional metadata
- **`EffectResult<R>`**: The union type that can be either success or failure

This type allows for safe error handling without throwing exceptions, making it ideal for scenarios where you want to handle errors gracefully or when working with remote commands that need to return structured responses.

### Handling Causes

The `handleCause` function processes Effect causes from the `run` and `runSafe` methods and converts them into an object structure compatible with the `EffectFailure` type.

```typescript
export function handleCause<F extends InstanceType<ErrorClass>>(cause: Cause.Cause<F>) {
	let message = Cause.pretty(cause);
	let status: NumericRange<300, 599> = 500;
	let extra: Record<string, unknown> = {};

	if (Cause.isFailType(cause)) {
		// Expected Errors
		const error = cause.error;
		status = error.status;
		extra.cause = error.cause;
		extra = Object.assign(extra, omit(error, ["_tag", "_op", "pipe", "name", "message", "status"]));

		Effect.runFork(AppLog.error(message, extra));
	}

	if (Cause.isDieType(cause)) {
		// Unexpected Errors
		const defect = cause.defect;

		if (isRedirect(defect)) {
			// SvelteKit redirect()
			message = `Redirect to ${defect.location}`;
			status = defect.status;
			extra.redirectTo = defect.location;
		} else if (isHttpError(defect)) {
			// SvelteKit error()
			status = defect.status as NumericRange<300, 599>;
			message = defect.body.message;
		} else if (defect instanceof Error) {
			// Re-throw ValidationError to preserve original error handling
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
```

The function handles both expected errors (failures) and unexpected errors (defects), with special handling for SvelteKit redirects, HTTP errors, and ValidationErrors that need to be re-thrown to preserve their original error handling behavior.

### Generator Support

Both run functions support generator-based Effect programs for more readable async code:

```typescript
const result =
	yield *
	run(function* () {
		const Characters = yield* CharacterService;
		const { user } = assertAuth();

		return yield* Characters.get.userCharacters(user.id);
	});
```

## Remote Function Guards

### Guarded Query

The `guardedQuery` function provides authentication and authorization for remote queries. It supports both schema-based and schema-less queries:

```typescript
// With schema validation
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

// Without schema (no input validation)
export function guardedQuery<
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(fn: (auth: { user: LocalsUser; event: RequestEvent }) => Generator<T, X>, adminOnly?: boolean): RemoteQueryFunction<void, X>;
```

The function internally uses `AuthService.guard()` to validate authentication and authorization:

```typescript
return query(schemaOrFn, (output) =>
	run(function* () {
		const Auth = yield* AuthService;
		const auth = yield* Auth.guard(adminOnly);
		return yield* fnOrAdminOnly(output, auth);
	})
);
```

### Guarded Command

The `guardedCommand` function provides similar protection for remote commands, returning `EffectResult` for safe error handling:

```typescript
// With schema validation
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

// Without schema
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
```

Commands use `runSafe` instead of `run` to return structured results instead of throwing:

```typescript
return command(schemaOrFn, (output) =>
	runSafe(function* () {
		const Auth = yield* AuthService;
		const auth = yield* Auth.guard(adminOnly);
		return yield* fnOrAdminOnly(output, auth);
	})
);
```

### Guarded Form

The `guardedForm` function provides authentication and authorization for remote forms, with access to form validation state:

```typescript
// With schema validation
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

// Without schema
export function guardedForm<
	Input extends RemoteFormInput,
	R,
	F extends InstanceType<ErrorClass>,
	S extends Services,
	T extends YieldWrap<Effect.Effect<R, F, S>>,
	X
>(
	fn: (output: Input, auth: { user: LocalsUser; event: RequestEvent; invalid: Invalid<Input> }) => Generator<T, X>,
	adminOnly?: boolean
): RemoteForm<Input, X>;
```

Forms provide access to the `invalid` function for handling validation errors:

```typescript
return form(schemaOrFn, (output, invalid) =>
	run(function* () {
		const Auth = yield* AuthService;
		const auth = yield* Auth.guard(adminOnly);
		return yield* fnOrAdminOnly(output, { invalid, ...auth });
	})
);
```

### Authentication Guard

The `AuthService.guard` method provides authentication and authorization:

```typescript
guard: Effect.fn(function* (adminOnly = false) {
	const event = getRequestEvent();
	const user = event.locals.user;

	if (!user) {
		const returnUrl = `${event.url.pathname}${event.url.search}`;
		return yield* new RedirectError({
			message: "Invalid user",
			redirectTo: `/?redirect=${encodeURIComponent(returnUrl)}`
		});
	}

	const result = v.safeParse(localsUserSchema, user);
	if (!result.success) return yield* new InvalidUser(result.issues);

	if (result.output.banned) {
		return yield* new RedirectError({
			message: "Banned",
			redirectTo: "/"
		});
	}

	if (adminOnly && result.output.role !== "admin") {
		return yield* new RedirectError({
			message: "Insufficient permissions",
			redirectTo: "/characters"
		});
	}

	return { user: result.output, event };
});
```

The guard validates the user exists, is not banned, and has appropriate permissions when `adminOnly` is true.

## Error Handling and Logging

### Error Types

The project defines a universal error base type. All expected errors are extended from this type:

```typescript
export interface ErrorParams {
	message: string;
	status: NumericRange<300, 599>;
	cause?: unknown;
	[key: string]: unknown;
}

export interface ErrorClass {
	new (...args: unknown[]): { _tag: string } & ErrorParams;
}
```

### Tagged Errors

All errors extend from tagged error classes using Effect's `Data.TaggedError`:

```typescript
export class FailedError extends Data.TaggedError("FailedError")<ErrorParams> {
	constructor(action: string, cause?: unknown) {
		super({ message: `Failed to ${action}`, status: 500, cause });
	}
}

export class RedirectError extends Data.TaggedError("RedirectError")<RedirectErrorParams> {
	constructor({
		message,
		redirectTo,
		status = 302,
		cause
	}: { message: string; redirectTo: FullPathname } & Partial<RedirectErrorParams>) {
		super({ message, redirectTo, status, cause });
	}
}

export class InvalidUser extends Data.TaggedError("InvalidUser")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Invalid user", status: 401, cause: err });
	}
}
```

### Tagged Error Detection

The project provides a helper function to detect tagged errors:

```typescript
export function isTaggedError(error: unknown): error is InstanceType<ErrorClass> {
	return (
		isInstanceOfClass(error) &&
		"status" in error &&
		typeof error.status === "number" &&
		error.status >= 400 &&
		error.status <= 599 &&
		"message" in error &&
		typeof error.message === "string" &&
		"_tag" in error &&
		typeof error._tag === "string"
	);
}
```

This is useful for error handling in transaction boundaries where you need to distinguish between tagged errors and unexpected defects.

### Logging Integration

The logging system integrates with Effect's logging infrastructure:

```typescript
export const AppLog = {
	info: (message: string, extra?: Record<string, unknown>, logger: Layer.Layer<never> = dbLogger) =>
		Effect.logInfo(message).pipe(logLevel, annotate(extra), Effect.provide(logger)),
	error: (message: string, extra?: Record<string, unknown>, logger: Layer.Layer<never> = dbLogger) =>
		Effect.logError(message).pipe(logLevel, annotate(extra), Effect.provide(logger)),
	debug: (message: string, extra?: Record<string, unknown>, logger: Layer.Layer<never> = dbLogger) =>
		Effect.logDebug(message).pipe(logLevel, annotate(extra), Effect.provide(logger))
};
```

### Database Logging

Logs are stored in the database with rich annotations and include console output in development:

```typescript
const dbLogger = Logger.replace(
	Logger.defaultLogger,
	Logger.make(async (log) => {
		const event = getRequestEvent();
		const runtime = event.locals.runtime;

		await runtime.runPromise(
			Effect.gen(function* () {
				const Admin = yield* AdminService;
				return yield* Admin.set
					.saveLog({
						label: (log.message as string[]).join(" | "),
						timestamp: log.date,
						level: log.logLevel.label,
						annotations: Object.fromEntries(HashMap.toEntries(log.annotations)) as Annotations
					})
					.pipe(
						Effect.tap(
							(log) =>
								dev &&
								Console.log(
									log.timestamp.toLocaleTimeString(),
									chalk.bold[
										log.level === "ERROR" ? "red" : log.level === "DEBUG" ? "yellow" : log.level === "INFO" ? "cyan" : "reset"
									](`[${log.level}]`),
									log.label
								)
						),
						Effect.tap(
							(log) =>
								dev &&
								(["ERROR", "DEBUG"].includes(log.level)
									? Console.dir(log.annotations, { depth: null })
									: Console.log(chalk.dim(JSON.stringify(log.annotations.extra))))
						),
						Effect.tap(() => dev && Console.log(""))
					);
			})
		);
	})
);
```

The logger automatically provides context annotations:

```typescript
function annotate(extra: Record<PropertyKey, unknown> = {}) {
	const event = getRequestEvent();
	return Effect.annotateLogs({
		userId: event.locals.user?.id,
		username: event.locals.user?.name,
		impersonatedBy: event.locals.session?.impersonatedBy,
		routeId: event.route.id,
		params: event.params,
		extra
	} satisfies Annotations);
}
```

## Schema Validation

### Parse and SafeParse

The project provides Effect-based schema validation using StandardSchema:

```typescript
export const parse = Effect.fn(function* <I, O = I>(schema: StandardSchemaV1<I, O>, input: I) {
	const parseResult = yield* Effect.promise(() => Promise.resolve(schema["~standard"].validate(input)));
	if (parseResult.issues) {
		const summary = summarize(parseResult.issues);
		return yield* new InvalidSchemaError(input, summary, parseResult.issues);
	}
	return parseResult.value;
});

export const safeParse = Effect.fn(function* <I, O = I>(schema: StandardSchemaV1<I, O>, input: I) {
	const result = yield* Effect.either(parse<I, O>(schema, input));
	if (Either.isLeft(result)) return { success: false, failure: result.left } as const;
	else return { success: true, data: result.right } as const;
});
```

The `InvalidSchemaError` includes detailed issue information:

```typescript
interface InvalidSchemaErrorParams extends ErrorParams {
	input: unknown;
	issues: readonly StandardSchemaV1.Issue[];
}

export class InvalidSchemaError extends Data.TaggedError("InvalidSchemaError")<InvalidSchemaErrorParams> {
	constructor(input: unknown, summary: string, issues: readonly StandardSchemaV1.Issue[]) {
		super({ message: summary, status: 400, input, issues });
	}
}
```

### Form Integration

Forms are handled using SvelteKit's `form` function with the `guardedForm` wrapper. The `invalid` function provided by SvelteKit is used to handle validation errors:

```typescript
export const save = guardedForm(dungeonMasterFormSchema, function* (input, { user, invalid }) {
	const DMs = yield* DMService;
	yield* DMs.set.save(user, input).pipe(Effect.tapError((err) => Effect.fail(invalid(err.message))));
	yield* refreshAll(API.dms.queries.get(input.id).refresh(), API.dms.queries.getAll().refresh());
	redirect(303, "/dms");
});
```

The `invalid` function allows setting field-specific or general form errors that will be automatically integrated with SvelteKit's form validation system.

## Usage Patterns

### Remote Query Example

Remote queries can be defined with or without input schemas:

```typescript
// Without input schema
export const getAll = guardedQuery(function* ({ user }) {
	const Characters = yield* CharacterService;
	return yield* Characters.get.all(user.id);
});

// With input schema
export const get = guardedQuery(dungeonMasterIdSchema, function* (input, { user }) {
	const DMs = yield* DMService;
	const dm = yield* DMs.get.one(input, user.id);

	return {
		id: dm.id,
		name: dm.name,
		DCI: dm.DCI || ""
	};
});
```

### Remote Command Example

Remote commands return `EffectResult` for safe error handling:

```typescript
export const save = guardedCommand(inputSchema, function* (input, { user }) {
	const Service = yield* SomeService;
	const result = yield* Service.set.save(input, user.id);

	// Refresh related queries
	yield* refreshAll(API.someResource.queries.get(result.id).refresh(), API.someResource.queries.getAll().refresh());

	return result;
});
```

### Remote Form Example

Remote forms have access to the `invalid` function for validation errors:

```typescript
export const save = guardedForm(dungeonMasterFormSchema, function* (input, { user, invalid }) {
	const DMs = yield* DMService;

	// Save the form data, handling errors with invalid()
	yield* DMs.set.save(user, input).pipe(Effect.tapError((err) => Effect.fail(invalid(err.message))));

	// Refresh queries after successful save
	yield* refreshAll(API.dms.queries.get(input.id).refresh(), API.dms.queries.getAll().refresh());

	// Redirect on success
	redirect(303, "/dms");
});
```

### Query Refresh Utility

The `refreshAll` utility helps refresh multiple queries after mutations:

```typescript
export const refreshAll = Effect.fn(function* (...queries: Promise<void>[]) {
	return yield* Effect.promise(() => Promise.all(queries));
});
```

### Service Usage Example

Services use `runQuery` for database operations:

```typescript
const character =
	yield *
	runQuery(
		db.query.characters.findFirst({
			with: characterIncludes(includeLogs),
			where: { id: { eq: characterId } }
		})
	).pipe(
		Effect.flatMap((character) =>
			character ? Effect.succeed(parseCharacter(character)) : Effect.fail(new CharacterNotFoundError())
		),
		Effect.tapError(() => AppLog.debug("CharacterService.get.character", { characterId, includeLogs }))
	);
```

### Schema Validation Example

Use `parse` for Effect-based validation:

```typescript
const result = yield * parse(localsUserSchema, user);
// result is the validated and transformed output
```

Or use `safeParse` for non-throwing validation:

```typescript
const result = yield * safeParse(userSchema, input);
if (result.success) {
	// Use result.data
} else {
	// Handle result.failure (InvalidSchemaError)
}
```

## Best Practices

### 1. Service Design

- Use consistent service interfaces with `get` and `set` namespaces
- Declare dependencies explicitly
- Use Effect functions for all service methods
- Provide both database and transaction variants when needed

### 2. Error Handling

- Use tagged errors for all error types
- Include appropriate HTTP status codes
- Provide meaningful error messages
- Include cause information for debugging

### 3. Logging

- Use structured logging with annotations
- Log at appropriate levels (debug, info, error)
- Include relevant context in log messages
- Use the database logger for persistence

### 4. Schema Validation

- Use `parse` for Effect-based validation that throws on errors
- Use `safeParse` for non-throwing validation
- Prefer StandardSchema for schema definitions
- Include detailed error information in validation failures

### 5. Form Handling

- Use `guardedForm` for form endpoints with authentication
- Leverage the `invalid` function for form validation errors
- Refresh related queries after successful form submissions using `refreshAll`
- Use SvelteKit redirects for navigation after form success

### 6. Authentication

- Use `AuthService.guard()` for authentication and authorization
- Check admin permissions with the `adminOnly` parameter
- Handle redirects appropriately using `RedirectError`
- Validate user data using schema validation before use

### 7. Database Operations

- Use transactions for multi-step operations that need atomicity
- Wrap queries in `runQuery` for proper error handling
- Use proper conflict resolution for upserts
- Handle database errors appropriately with `DrizzleError`
- Use `DBService.transaction()` for Effect-based transactions

## Additional Utilities

### Query Refresh

After mutations, refresh related queries to keep the UI in sync:

```typescript
yield * refreshAll(API.resource.queries.get(id).refresh(), API.resource.queries.getAll().refresh());
```

### Error Handling in Transactions

When using transactions, tagged errors are automatically handled:

```typescript
const result = yield * DBService;
yield *
	result.transaction(function* (tx) {
		const Service = yield* SomeService;
		// Service operations that may fail
		// Tagged errors will be properly propagated and cause rollback
	});
```

### Development Logging

In development mode, logs are automatically printed to the console with color coding:

- **ERROR**: Red
- **DEBUG**: Yellow
- **INFO**: Cyan

Error and debug logs include full annotation details, while info logs show a summary.

This integration provides a robust, type-safe, and maintainable way to build SvelteKit applications with Effect.ts, combining the best of both frameworks for a superior developer experience.
