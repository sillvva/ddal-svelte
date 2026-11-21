import { request } from "#lib/remote/app/queries.remote.js";
import { getAll as getAllCharacters } from "#lib/remote/characters/queries.remote.js";
import { storage } from "#lib/remote/images/queries.remote.js";
import { requiredString, userIdSchema, type UserId } from "#lib/schemas.js";
import { guardedForm, refreshAll } from "#lib/server/effect/guarded.js";
import { AdminService } from "#lib/server/effect/services/admin.js";
import { AuthService } from "#lib/server/effect/services/auth.js";
import { invalid, redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import * as v from "valibot";
import { getUsers } from "./queries.remote.js";

export const impersonateUser = guardedForm(
	v.object({ userId: userIdSchema }),
	function* ({ userId }, { event, issue }) {
		const Auth = yield* AuthService;
		const Admin = yield* AdminService;

		const user = yield* Admin.get.user(userId).pipe(Effect.catch((err) => Effect.die(invalid(issue(err.message)))));

		if (user.banned) throw invalid("User is banned");
		if (user.role === "admin") throw invalid("Cannot impersonate this user");

		const impersonated = yield* Effect.tryPromise(() =>
			Auth.api.impersonateUser({
				body: { userId },
				headers: event.request.headers
			})
		);

		const locals = yield* Auth.get.locals(impersonated.user.id as UserId, impersonated.session);
		event.locals.session = locals.session;
		event.locals.user = locals.user;

		yield* refreshAll(
			request().refresh(),
			...(locals.user?.onboarded ? [getAllCharacters().refresh(), storage().refresh()] : [])
		);

		redirect(302, "/characters");
	},
	"admin"
);

export const stopImpersonating = guardedForm(function* ({ event }) {
	const Auth = yield* AuthService;

	const restored = yield* Effect.tryPromise(() =>
		Auth.api.stopImpersonating({
			headers: event.request.headers
		})
	);

	const locals = yield* Auth.get.locals(restored.user.id as UserId, restored.session);
	event.locals.session = locals.session;
	event.locals.user = locals.user;

	yield* refreshAll(request().refresh(), getUsers().refresh(), getAllCharacters().refresh(), storage().refresh());

	redirect(302, "/admin/users");
});

export const banUser = guardedForm(
	v.object({ userId: userIdSchema, banReason: requiredString }),
	function* ({ userId, banReason }, { event }) {
		const Auth = yield* AuthService;
		const Admin = yield* AdminService;

		const user = yield* Admin.get.user(userId).pipe(Effect.catch((err) => Effect.die(invalid(err.message))));

		if (user.role === "admin") throw invalid("Cannot ban admins");
		if (user.banned) throw invalid("User is already banned");

		return yield* Effect.tryPromise(() =>
			Auth.api.banUser({
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
		const Auth = yield* AuthService;

		return yield* Effect.tryPromise(() =>
			Auth.api.unbanUser({
				body: { userId },
				headers: event.request.headers
			})
		);
	},
	"admin"
);
