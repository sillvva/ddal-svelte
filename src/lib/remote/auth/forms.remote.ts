import { onboardingSchema } from "#lib/schemas.js";
import { FailedError, type ErrorParams } from "#lib/server/effect/errors.js";
import { guardedForm } from "#lib/server/effect/guarded.js";
import { AuthService } from "#lib/server/effect/services/auth.js";
import { StorageService } from "#lib/server/effect/services/storage.js";
import { invalid, redirect } from "@sveltejs/kit";
import { Data, Effect } from "effect";

class ImpersonatingError extends Data.TaggedError("ImpersonatingError")<ErrorParams> {
	constructor() {
		super({ message: "Stop impersonating before deleting an account", status: 400 });
	}
}

export const signOut = guardedForm(function* ({ event }) {
	const Auth = yield* AuthService;

	yield* Effect.tryPromise(() =>
		Auth.api.signOut({
			headers: event.request.headers
		})
	);

	redirect(302, "/");
});

export const deleteAccount = guardedForm(function* ({ user, event }) {
	if (event.locals.session?.impersonatedBy) return yield* new ImpersonatingError();

	const Auth = yield* AuthService;
	const Storage = yield* StorageService;
	const keys = yield* Storage.collectUserKeys(user.id);
	yield* Auth.user.delete(user.id);
	yield* Storage.purgeKeys(user.id, keys);

	yield* Effect.tryPromise({
		try: () =>
			Auth.api.signOut({
				headers: event.request.headers
			}),
		catch: (err) => new FailedError("sign out", err)
	}).pipe(Effect.catch(() => Effect.void));

	redirect(302, "/");
});

export const completeOnboarding = guardedForm(
	onboardingSchema,
	function* (input, { user, issue }) {
		const Auth = yield* AuthService;
		const taken = yield* Auth.get.emailTaken(input.email, user.id);
		if (taken) invalid(issue.email("An account with this email already exists"));

		yield* Auth.completeOnboarding(user.id, input);
		redirect(303, "/characters");
	},
	"onboarding"
);

export const cancelOnboarding = guardedForm(function* ({ user, event }) {
	const Auth = yield* AuthService;
	const Storage = yield* StorageService;
	const keys = yield* Storage.collectUserKeys(user.id);
	yield* Auth.user.delete(user.id);
	yield* Storage.purgeKeys(user.id, keys);

	yield* Effect.tryPromise({
		try: () =>
			Auth.api.signOut({
				headers: event.request.headers
			}),
		catch: (err) => new FailedError("sign out", err)
	}).pipe(Effect.catch(() => Effect.void));

	redirect(302, "/");
}, "onboarding");
