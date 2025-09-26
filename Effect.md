# Effect.ts Integration with SvelteKit

This document provides a comprehensive overview of how Effect.ts has been integrated with SvelteKit in this project, covering the managed runtime, database service, run methods, command and query guards, and error logging.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Managed Runtime Setup](#managed-runtime-setup)
3. [Database Service Integration](#database-service-integration)
4. [Service Layer Architecture](#service-layer-architecture)
5. [Run Methods](#run-methods)
6. [Command and Query Guards](#command-and-query-guards)
7. [Error Handling and Logging](#error-handling-and-logging)
8. [Form Integration](#form-integration)
9. [Usage Patterns](#usage-patterns)
10. [Best Practices](#best-practices)

## Architecture Overview

The Effect.ts integration follows a layered architecture pattern:

```
┌─────────────────────────────────────┐
│          SvelteKit Routes           │
├─────────────────────────────────────┤
│       Remote Queries/Commands       │
├─────────────────────────────────────┤
│           Effect Services           │
├─────────────────────────────────────┤
│           Database Layer            │
├─────────────────────────────────────┤
│           Managed Runtime           │
└─────────────────────────────────────┘
```

## Managed Runtime Setup

### Runtime Initialization

The managed runtime is created in `src/hooks.server.ts` and provides a centralized way to manage Effect services across the application:

```typescript
const createAppRuntime = () => {
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

### Graceful Shutdown

The runtime includes proper cleanup on server shutdown:

```typescript
const gracefulShutdown = async (signal: string) => {
  console.log("Disposing app runtime...");
  await appRuntime.dispose();
  console.log("Ending DB connection...");
  await DBService.end();
  process.exit(0);
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
    readonly character: (characterId: CharacterId, includeLogs?: boolean) => Effect.Effect<FullCharacterData, DrizzleError | CharacterNotFoundError>;
    readonly userCharacters: (userId: UserId, options?: { characterId?: CharacterId | null; includeLogs?: boolean }) => Effect.Effect<FullCharacterData[], DrizzleError>;
  };
  readonly set: {
    readonly save: (data: CharacterSchema, userId: UserId) => Effect.Effect<Character, SaveCharacterError | DrizzleError>;
    readonly delete: (characterId: CharacterId, userId: UserId) => Effect.Effect<{ id: CharacterId }, DeleteCharacterError | DrizzleError | TransactionError>;
  };
}
```

## Run Methods

### Main Run Function

The `run` function provides the primary way to execute Effect programs in the SvelteKit context:

```typescript
export async function run<
  R,
  F extends InstanceType<ErrorClass>,
  S extends Services,
  T extends YieldWrap<Effect.Effect<R, F, S>>,
  X,
  Y
>(program: Effect.Effect<R, F, S> | (() => Effect.Effect<R, F, S>) | (() => Generator<T, X, Y>)): Promise<R | X> {
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
        throw redirect(err.status, err.redirectTo);
      }
      throw error(err.status, err.message);
    }
  });
}
```

### Safe Run Function

The `runSafe` function provides error-safe execution that returns a result type instead of throwing:

```typescript
export async function runSafe<
  R,
  F extends InstanceType<ErrorClass>,
  S extends Services,
  T extends YieldWrap<Effect.Effect<R, F, S>>,
  X,
  Y
>(program: Effect.Effect<R, F, S> | (() => Effect.Effect<R, F, S>) | (() => Generator<T, X, Y>)): Promise<EffectResult<R | X>> {
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

  if (Cause.isFailType(cause)) { // Expected Errors
    const error = cause.error;
    status = error.status;
    extra.cause = error.cause;
    extra = Object.assign(extra, omit(error, ["_tag", "_op", "pipe", "name", "message", "status"]));

    Effect.runFork(AppLog.error(message, extra));
  }

	if (Cause.isDieType(cause)) { // Unexpected Errors
		const defect = cause.defect;

		if (isRedirect(defect)) { // SvelteKit redirect()
			message = `Redirect to ${defect.location}`;
			status = defect.status;
			extra.redirectTo = defect.location;
		} else if (isHttpError(defect)) { // SvelteKit error()
			status = defect.status as NumericRange<300, 599>;
			message = defect.body.message;
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

### Generator Support

Both run functions support generator-based Effect programs for more readable async code:

```typescript
const result = yield* run(function* () {
  const Characters = yield* CharacterService;
  const { user } = assertAuth();

  return yield* Characters.get.userCharacters(user.id);
});
```

## Command and Query Guards

### Guarded Query

The `guardedQuery` function provides authentication and authorization for remote queries:

```typescript
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
```

### Guarded Command

The `guardedCommand` function provides similar protection for remote commands:

```typescript
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
```

### Authentication Guard

The `assertAuth` function provides authentication and authorization:

```typescript
export const assertAuth = Effect.fn(function* (adminOnly = false) {
  const event = getRequestEvent();
  const user = event.locals.user;
  const url = event.url;

  if (!user) {
    return yield* new RedirectError({
      message: "Invalid user",
      redirectTo: `/?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`
    });
  }

  // Additional validation and authorization logic...

  return { user: result.output, event };
});
```

## Error Handling and Logging

### Error Types

The project defines a universal error base type. All expected errors are extended from this type.

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

All errors extend from tagged error classes:

```typescript
export class CharacterNotFoundError extends Data.TaggedError("CharacterNotFoundError")<ErrorParams> {
  constructor(err?: unknown) {
    super({ message: "Character not found", status: 404, cause: err });
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
```

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

Logs are stored in the database with rich annotations:

```typescript
const dbLogger = Logger.replace(
  Logger.defaultLogger,
  Logger.make(async (log) => {
    const event = getRequestEvent();
    const runtime = event.locals.runtime;

    await runtime.runPromise(
      Effect.gen(function* () {
        const Admin = yield* AdminService;
        return yield* Admin.set.saveLog({
          label: (log.message as string[]).join(" | "),
          timestamp: log.date,
          level: log.logLevel.label,
          annotations: Object.fromEntries(HashMap.toEntries(log.annotations)) as Annotations
        });
      })
    );
  })
);
```

## Form Integration

### Form Validation

The project integrates with SvelteKit Superforms for form handling:

```typescript
export function validateForm<
  Schema extends v.GenericSchema,
  Input extends SuperValidateData | Partial<InferIn<Schema, "valibot">>
>(input: Input, schema: Schema, options?: SuperValidateOptions<Infer<Schema, "valibot">>) {
  return Effect.promise(() => superValidate(input, valibot(schema), options));
}
```

### Form Error Handling

Form errors are integrated with Effect error handling:

```typescript
export class FormError<SchemaOut extends Record<PropertyKey, unknown>> extends Data.TaggedError("FormError")<ErrorParams> {
  constructor(
    public message: string,
    protected options: Partial<{
      field: "" | FormPathLeavesWithErrors<SchemaOut>;
      status: NumericRange<300, 599>;
      cause: unknown;
    }> = {}
  ) {
    super({ message, status: options.status || 500, cause: options.cause });
  }

  toForm(form: SuperValidated<SchemaOut>) {
    return setError(form, this.options?.field ?? "", this.message, {
      status: this.status < 400 ? 400 : (this.status as NumericRange<400, 599>)
    });
  }
}
```

### Form Saving

The `saveForm` function provides a complete form handling workflow:

```typescript
export const saveForm = Effect.fn(function* <
  TSuccess extends Pathname | TForm,
  TFailure extends Pathname | TForm,
  TForm extends SuperValidated<SchemaOut>,
  SchemaOut extends Record<PropertyKey, unknown>,
  ServiceOut = unknown
>(
  program: Effect.Effect<ServiceOut, FormError<SchemaOut> | InstanceType<ErrorClass>>,
  handlers: {
    onSuccess: (data: ServiceOut) => Awaitable<TSuccess>;
    onError: (err: FormError<SchemaOut>) => Awaitable<TFailure>;
  }
) {
  return yield* program.pipe(
    Effect.catchAll(FormError.from<SchemaOut>),
    Effect.match({
      onSuccess: handlers.onSuccess,
      onFailure: async (error) => {
        const result = await handlers.onError(error);
        const message = Cause.pretty(Cause.fail(error));
        Effect.runFork(AppLog.error(message, { result, error }));
        return result;
      }
    }),
    Effect.flatMap((result) => Effect.promise(async () => result))
  );
});
```

## Usage Patterns

### Remote Query Example

```typescript
export const getCharacters = guardedQuery(function* ({ user }) {
  const Characters = yield* CharacterService;
  return yield* Characters.get.userCharacters(user.id);
});
```

### Remote Command Example

```typescript
export const save = guardedCommand(function* (input: LogSchemaIn, { user }) {
  const Characters = yield* CharacterService;
  const Logs = yield* LogService;

  // Form validation and processing...

  return yield* saveForm(Logs.set.save(form.data, user), {
    onSuccess: () => redirectTo,
    onError: (err) => {
      err.toForm(form);
      return form;
    }
  });
});
```

### Service Usage Example

```typescript
const character = yield* runQuery(
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

### 4. Form Handling

- Use Effect-based form validation
- Integrate form errors with Effect error handling
- Provide proper success/failure handlers
- Use the `saveForm` utility for complex workflows

### 5. Authentication

- Use the `assertAuth` function for authentication
- Check admin permissions when needed
- Handle redirects appropriately
- Validate user data before use

### 6. Database Operations

- Use transactions for multi-step operations
- Wrap queries in `runQuery` for error handling
- Use proper conflict resolution for upserts
- Handle database errors appropriately

This integration provides a robust, type-safe, and maintainable way to build SvelteKit applications with Effect.ts, combining the best of both frameworks for a superior developer experience.
