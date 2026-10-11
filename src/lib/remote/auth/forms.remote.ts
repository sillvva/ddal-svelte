import { onboardingSchema } from "#lib/schemas.js";
import { FailedError, type ErrorParams } from "#lib/server/effect/errors.js";
import { guardedForm } from "#lib/server/effect/guarded.js";
import { AuthService } from "#lib/server/effect/services/auth.js";
import { UserService } from "#lib/server/effect/services/users.js";
import { invalid, redirect } from "@sveltejs/kit";
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

export const completeOnboarding = guardedForm(
	onboardingSchema,
	function* (input, { user, issue }) {
		const Users = yield* UserService;
		const taken = yield* Users.emailTaken(input.email, user.id);
		if (taken) invalid(issue.email("An account with this email already exists"));

		yield* Users.completeOnboarding(user.id, input);
		redirect(303, "/characters");
	},
	"onboarding"
);

export const cancelOnboarding = guardedForm(function* ({ user, event }) {
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
}, "onboarding");
