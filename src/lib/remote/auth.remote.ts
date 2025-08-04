import { command } from "$app/server";
import { authName } from "$lib/auth";
import { imageUrlWithFallback, requiredString } from "$lib/schemas.js";
import { assertAuthOrFail } from "$lib/server/auth";
import { db, runQuery } from "$lib/server/db";
import { passkey } from "$lib/server/db/schema.js";
import { runRemote, type ErrorParams } from "$lib/server/effect";
import { withUser } from "$lib/server/effect/users";
import { and, eq } from "drizzle-orm";
import { Data, Effect } from "effect";
import { isTupleOf } from "effect/Predicate";
import * as v from "valibot";

class NoChangesError extends Data.TaggedError("NoChangesError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "No changes to update", status: 400, cause: err });
	}
}

class NoPasskeyError extends Data.TaggedError("NoPasskeyError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "No passkey found", status: 404, cause: err });
	}
}

class NameAlreadyExistsError extends Data.TaggedError("NameAlreadyExistsError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Name already exists", status: 400, cause: err, retry: true });
	}
}

class FailedError extends Data.TaggedError("FailedError")<ErrorParams> {
	constructor(action: string, cause?: unknown) {
		super({ message: `Failed to ${action}`, status: 500, cause });
	}
}

export const updateUser = command(
	v.partial(
		v.object({
			name: requiredString,
			email: requiredString,
			image: imageUrlWithFallback
		})
	),
	(input) =>
		runRemote(function* () {
			const user = yield* assertAuthOrFail();

			if (Object.keys(input).length === 0) return yield* Effect.fail(new NoChangesError());

			return yield* withUser((service) => service.set.update(user.id, input)).pipe(
				Effect.catchTag("DrizzleError", (err) => Effect.fail(new FailedError("update user", err)))
			);
		})
);

export const renamePasskey = command(
	v.object({
		name: v.string(),
		id: v.optional(v.string())
	}),
	(input) =>
		runRemote(function* () {
			const user = yield* assertAuthOrFail();

			const passkeys = yield* runQuery(
				db.query.passkey.findMany({
					where: {
						userId: {
							eq: user.id
						}
					}
				})
			);

			const auth = passkeys.find((a) => (input.id ? a.id === input.id : a.name === ""));
			if (!auth) return yield* Effect.fail(new NoPasskeyError());
			if (!input.name.trim()) input.name = authName(auth);

			const existing = passkeys.find((a) => a.name === input.name);
			if (existing && (!auth.name || (input.id && existing.id !== input.id)))
				return yield* Effect.fail(new NameAlreadyExistsError());

			yield* runQuery(
				db
					.update(passkey)
					.set({ name: input.name.trim() })
					.where(and(eq(passkey.id, auth.id)))
					.returning()
			).pipe(Effect.catchTag("DrizzleError", (err) => Effect.fail(new FailedError("rename passkey", err))));

			return { name: input.name };
		})
);

export const deletePasskey = command(v.object({ id: v.pipe(v.string(), v.uuid()) }), (input) =>
	runRemote(function* () {
		const user = yield* assertAuthOrFail();

		const auth = yield* runQuery(
			db.query.passkey.findFirst({
				where: {
					id: input.id,
					userId: {
						eq: user.id
					}
				}
			})
		);

		if (!auth) return yield* Effect.fail(new NoPasskeyError());

		const result = yield* runQuery(
			db
				.delete(passkey)
				.where(and(eq(passkey.id, auth.id)))
				.returning()
		).pipe(Effect.catchTag("DrizzleError", (err) => Effect.fail(new FailedError("delete passkey", err))));

		if (isTupleOf(result, 1)) return result[0].id;
		return yield* Effect.fail(new NoPasskeyError());
	})
);
