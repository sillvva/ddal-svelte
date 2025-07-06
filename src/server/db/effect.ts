import { dev } from "$app/environment";
import type { DictOrArray } from "@sillvva/utils";
import { redirect, type ActionFailure, type NumericRange } from "@sveltejs/kit";
import { Context, Data, Effect } from "effect";
import { setError, type FormPathLeavesWithErrors, type SuperValidated } from "sveltekit-superforms";
import { db, type Database, type Transaction } from ".";

export class DBService extends Context.Tag("Database")<DBService, { readonly db: Effect.Effect<Database | Transaction> }>() {}

export function withDB<T, E>(program: Effect.Effect<T, E, DBService>, dbOrTx: Database | Transaction = db) {
	return Effect.provideService(program, DBService, {
		db: Effect.succeed(dbOrTx)
	});
}

export function withTransaction<T, E extends FetchError | FormError<any, any> | Error>(
	program: Effect.Effect<T, E, DBService>,
	database: Database = db
) {
	return database.transaction(async (tx) => {
		return Effect.runPromise(withDB(program, tx).pipe(Effect.catchAll(Effect.die)));
	});
}

const unknownError = "Unknown error";

function hasMessage(obj: unknown): obj is { message: string } {
	return typeof obj === "object" && obj !== null && "message" in obj && typeof (obj as any).message === "string";
}

function extractMessage(err: unknown, fallback = unknownError): string {
	if (!err) return "Undefined error";
	if (typeof err === "string") return err;
	if (hasMessage(err)) return err.message;
	return fallback;
}

export class FetchError extends Data.TaggedError("FetchError")<{
	message: string;
}> {
	constructor(public message: string = unknownError) {
		super({ message });
	}

	static from(err: FetchError | Error | unknown): FetchError {
		if (dev) console.error(err);
		if (err instanceof FetchError) return err;
		return new FetchError(extractMessage(err));
	}
}

export function fetchWithFallback<TOut extends DictOrArray | undefined, TError extends FetchError = FetchError>(
	program: Effect.Effect<TOut, TError, DBService>,
	fallback: (err: TError) => TOut
) {
	return Effect.runPromise(withDB(program).pipe(Effect.catchAll((err) => Effect.succeed(fallback(err)))));
}

export class FormError<
	TOut extends Record<PropertyKey, any>,
	TIn extends Record<PropertyKey, any> = TOut
> extends Data.TaggedError("FormError")<{
	message: string;
}> {
	public status: NumericRange<400, 599> = 500;

	constructor(
		public message: string = unknownError,
		protected options: Partial<{
			field: "" | FormPathLeavesWithErrors<TOut>;
			status: NumericRange<400, 599>;
		}> = {}
	) {
		super({ message });
		if (options.status) this.status = options.status;
	}

	static from<TOut extends Record<PropertyKey, any>, TIn extends Record<PropertyKey, any> = TOut>(
		err: FormError<TOut, TIn> | Error | unknown
	): FormError<TOut, TIn> {
		if (dev) console.error(err);
		if (err instanceof FormError) return err;
		return new FormError<TOut, TIn>(extractMessage(err));
	}

	toForm(form: SuperValidated<TOut, App.Superforms.Message, TIn>) {
		return setError(form, this.options?.field || "", this.message, {
			status: this.status
		});
	}
}

export async function save<
	TOut extends Record<PropertyKey, any>,
	TIn extends Record<PropertyKey, any> = TOut,
	TError extends FormError<any, TIn> = FormError<any, TIn>,
	TSuccess extends any = any
>(
	program: Effect.Effect<TIn, TError, DBService>,
	handlers: {
		onError: (err: TError) => ActionFailure<{ form: SuperValidated<TOut, App.Superforms.Message, TIn> }>;
		onSuccess: (data: TIn) => TSuccess;
	}
) {
	const result = await Effect.runPromise(
		Effect.match(withDB(program), {
			onSuccess: handlers.onSuccess,
			onFailure: handlers.onError
		})
	);

	if (typeof result === "string" && result.startsWith("/")) redirect(302, result);

	return result;
}
