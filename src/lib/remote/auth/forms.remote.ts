import { guardedForm } from "#lib/server/effect/guarded.js";
import { AuthService } from "#lib/server/effect/services/auth.js";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";

export const signOut = guardedForm(function* ({ event }) {
	const { auth } = yield* AuthService;

	yield* Effect.tryPromise(() =>
		auth.api.signOut({
			headers: event.request.headers
		})
	);

	redirect(302, "/");
});
