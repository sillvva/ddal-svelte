import { requiredString, userIdSchema } from "#lib/schemas.js";
import { guardedForm } from "#lib/server/effect/guarded.js";
import { AdminService } from "#lib/server/effect/services/admin.js";
import { AuthService } from "#lib/server/effect/services/auth.js";
import { invalid, redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import * as v from "valibot";

export const impersonateUser = guardedForm(
	v.object({ userId: userIdSchema }),
	function* ({ userId }, { event, issue }) {
		const { auth } = yield* AuthService;
		const Admin = yield* AdminService;

		const user = yield* Admin.get.user(userId).pipe(Effect.catch((err) => Effect.die(invalid(issue(err.message)))));

		if (user.banned) throw invalid("User is banned");
		if (user.role === "admin") throw invalid("Cannot impersonate this user");

		yield* Effect.tryPromise(() =>
			auth.api.impersonateUser({
				body: { userId },
				headers: event.request.headers
			})
		);

		redirect(302, "/characters");
	},
	"admin"
);

export const stopImpersonating = guardedForm(function* ({ event }) {
	const { auth } = yield* AuthService;

	yield* Effect.tryPromise(() =>
		auth.api.stopImpersonating({
			headers: event.request.headers
		})
	);

	redirect(302, "/admin/users");
});

export const banUser = guardedForm(
	v.object({ userId: userIdSchema, banReason: requiredString }),
	function* ({ userId, banReason }, { event }) {
		const { auth } = yield* AuthService;
		const Admin = yield* AdminService;

		const user = yield* Admin.get.user(userId).pipe(Effect.catch((err) => Effect.die(invalid(err.message))));

		if (user.role === "admin") throw invalid("Cannot ban admins");
		if (user.banned) throw invalid("User is already banned");

		return yield* Effect.tryPromise(() =>
			auth.api.banUser({
				body: { userId, banReason },
				headers: event.request.headers
			})
		);
	},
	"admin"
);

export const unbanUser = guardedForm(
	v.object({ userId: userIdSchema }),
	function* ({ userId }, { event }) {
		const { auth } = yield* AuthService;

		return yield* Effect.tryPromise(() =>
			auth.api.unbanUser({
				body: { userId },
				headers: event.request.headers
			})
		);
	},
	"admin"
);
