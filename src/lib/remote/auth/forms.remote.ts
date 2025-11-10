import { guardedForm } from "$lib/server/effect/remote";
import { AuthService } from "$lib/server/effect/services/auth";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";

export const signOut = guardedForm(function* ({ event }) {
	const Auth = yield* AuthService;
	const auth = yield* Auth.auth();

	yield* Effect.promise(() =>
		auth.api.signOut({
			headers: event.request.headers
		})
	);

	redirect(302, "/");
});
