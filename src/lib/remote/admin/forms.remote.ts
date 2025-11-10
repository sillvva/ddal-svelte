import { userIdSchema } from "$lib/schemas";
import { guardedForm } from "$lib/server/effect/remote";
import { AdminService } from "$lib/server/effect/services/admin";
import { AuthService } from "$lib/server/effect/services/auth";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import * as v from "valibot";

export const impersonateUser = guardedForm(
	v.object({ userId: userIdSchema }),
	function* ({ userId }, { event, invalid }) {
		const Auth = yield* AuthService;
		const Admin = yield* AdminService;

		const auth = yield* Auth.auth();
		const user = yield* Admin.get.user(userId).pipe(Effect.catchAll((err) => Effect.die(invalid(err.message))));

		if (user.banned) throw invalid("User is banned");
		if (user.role === "admin") throw invalid("Cannot impersonate this user");

		yield* Effect.promise(() => auth.api.impersonateUser({ body: { userId }, headers: event.request.headers }));

		redirect(302, "/characters");
	},
	true
);

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
