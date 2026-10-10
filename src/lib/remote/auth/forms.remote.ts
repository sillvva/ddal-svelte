import { FailedError, type ErrorParams } from "#lib/server/effect/errors.js";
import { guardedForm } from "#lib/server/effect/guarded.js";
import { AuthService } from "#lib/server/effect/services/auth.js";
import { UserService } from "#lib/server/effect/services/users.js";
import { redirect } from "@sveltejs/kit";
import { Data, Effect } from "effect";

class ImpersonatingError extends Data.TaggedError("ImpersonatingError")<ErrorParams> {
	constructor() {
		super({ message: "Stop impersonating before deleting an account", status: 400 });
	}
}

export const signOut = guardedForm(function* ({ event }) {
	const { auth } = yield* AuthService;

	yield* Effect.tryPromise(() =>
		auth.api.signOut({
			headers: event.request.headers
		})
	);

	redirect(302, "/");
});

export const deleteAccount = guardedForm(function* ({ user, event }) {
	if (event.locals.session?.impersonatedBy) return yield* new ImpersonatingError();

	const Users = yield* UserService;
	yield* Users.delete(user.id);

	const { auth } = yield* AuthService;
	yield* Effect.tryPromise({
		try: () =>
			auth.api.signOut({
				headers: event.request.headers
			}),
		catch: (err) => new FailedError("sign out", err)
	}).pipe(Effect.catch(() => Effect.void));

	redirect(302, "/");
});
