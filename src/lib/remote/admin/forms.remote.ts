import { guardedForm } from "$lib/server/effect/remote";
import { AuthService } from "$lib/server/effect/services/auth";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";

export const stopImpersonating = guardedForm(function* (_, { event }) {
	const Auth = yield* AuthService;
	const auth = yield* Auth.auth();

	yield* Effect.promise(() =>
		auth.api.stopImpersonating({
			headers: event.request.headers
		})
	);

	redirect(302, "/admin/users");
});
