import { authName } from "$lib/auth";
import { db, query } from "$lib/server/db";
import { passkey } from "$lib/server/db/schema";
import { Log, run } from "$lib/server/effect";
import type { ErrorParams } from "$lib/types";
import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { Data, Effect } from "effect";

class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "You must be logged in to perform this action", status: 401, cause: err });
	}
}
class NoPasskeyError extends Data.TaggedError("NoPasskeyError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "No passkey found", status: 404, cause: err });
	}
}
class NameAlreadyExistsError extends Data.TaggedError("NameAlreadyExistsError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Name already exists", status: 400, cause: err });
	}
}

export type RenameWebAuthnResponse = { success: true; name: string } | { success: false; error: string; throw?: boolean };
export type RenameWebAuthnInput = { name: string; id?: string };
export const POST = async ({ request, locals }) =>
	run(
		Effect.fn("RenameWebAuthn")(
			function* () {
				const user = locals.user;
				if (!user?.id) return yield* Effect.fail(new UnauthorizedError());

				let { name, id } = (yield* Effect.promise(() => request.json())) as RenameWebAuthnInput;
				const passkeys = yield* query(
					db.query.passkey.findMany({
						where: {
							userId: {
								eq: user.id
							}
						}
					})
				);

				const auth = passkeys.find((a) => (id ? a.id === id : a.name === ""));
				if (!auth) return yield* Effect.fail(new NoPasskeyError());
				if (!name.trim()) name = authName(auth);

				const existing = passkeys.find((a) => a.name === name);
				if (existing && (!auth.name || (id && existing.id !== id))) return yield* Effect.fail(new NameAlreadyExistsError());

				yield* query(
					db
						.update(passkey)
						.set({ name: name.trim() })
						.where(and(eq(passkey.id, auth.id)))
						.returning()
				);

				return { success: true, name } satisfies RenameWebAuthnResponse;
			},
			(effect) =>
				effect.pipe(
					Effect.map((result) => json(result, { status: 200 })),
					Effect.tapError((e) => Log.error(`[RenameWebAuthn] ${e.message}`, { status: e.status, cause: e.cause })),
					Effect.catchTag("NoPasskeyError", (e) =>
						Effect.succeed(
							json({ success: false, error: e.message, throw: true } satisfies RenameWebAuthnResponse, { status: e.status })
						)
					),
					Effect.catchAll((e) =>
						Effect.succeed(json({ success: false, error: e.message } satisfies RenameWebAuthnResponse, { status: e.status }))
					)
				)
		)
	);

export type DeleteWebAuthnResponse = { success: true } | { success: false; error: string };
export type DeleteWebAuthnInput = { id: string };
export const DELETE = ({ request, locals }) =>
	run(
		Effect.fn("DeleteWebAuthn")(
			function* () {
				const user = locals.user;
				if (!user?.id) return yield* Effect.fail(new UnauthorizedError());

				const { id } = (yield* Effect.promise(() => request.json())) as DeleteWebAuthnInput;
				const auth = yield* query(
					db.query.passkey.findFirst({
						where: {
							id: id,
							userId: {
								eq: user.id
							}
						}
					})
				);

				if (!auth) return yield* Effect.fail(new NoPasskeyError());

				yield* query(db.delete(passkey).where(and(eq(passkey.id, auth.id))));

				return { success: true } satisfies DeleteWebAuthnResponse;
			},
			(effect) =>
				effect.pipe(
					Effect.map((result) => json(result, { status: 200 })),
					Effect.tapError((e) => Log.error(`[DeleteWebAuthn] ${e.message}`, { status: e.status, cause: e.cause })),
					Effect.catchAll((e) =>
						Effect.succeed(json({ success: false, error: e.message } satisfies DeleteWebAuthnResponse, { status: e.status }))
					)
				)
		)
	);
