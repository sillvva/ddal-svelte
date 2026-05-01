import { getRequestEvent } from "$app/server";
import { privateEnv } from "$lib/env/private";
import { localsSessionSchema, localsUserSchema, type UserId } from "$lib/schemas";
import { DBService } from "$lib/server/db";
import { RedirectError, type ErrorParams } from "$lib/server/effect/errors";
import { passkey } from "@better-auth/passkey";
import { isDefined } from "@sillvva/utils";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { lastLoginMethod } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { Data, Duration, Effect } from "effect";
import { v7 } from "uuid";
import * as v from "valibot";
import { parse } from "../util";
import { UserService } from "./users";

class AuthError extends Data.TaggedError("AuthError")<ErrorParams> {
	constructor(err: unknown) {
		super({ message: "Authentication error", status: 500, cause: err });
	}
}

export class InvalidUser extends Data.TaggedError("InvalidUser")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Invalid user", status: 401, cause: err });
	}
}

export class AuthService extends Effect.Service<AuthService>()("AuthService", {
	dependencies: [DBService.Default()],
	effect: Effect.fn("AuthService")(function* () {
		const { db } = yield* DBService;

		const auth = betterAuth({
			appName: "Adventurers League Log Sheet",
			database: drizzleAdapter(db, {
				provider: "pg"
			}),
			secret: privateEnv.AUTH_SECRET,
			baseURL: privateEnv.PUBLIC_URL,
			socialProviders: {
				google: {
					clientId: privateEnv.GOOGLE_CLIENT_ID,
					clientSecret: privateEnv.GOOGLE_CLIENT_SECRET,
					disableSignUp: privateEnv.DISABLE_SIGNUPS
				},
				discord: {
					clientId: privateEnv.DISCORD_CLIENT_ID,
					clientSecret: privateEnv.DISCORD_CLIENT_SECRET,
					disableSignUp: privateEnv.DISABLE_SIGNUPS
				}
			},
			plugins: [passkey(), admin(), lastLoginMethod(), sveltekitCookies(getRequestEvent)],
			account: {
				accountLinking: {
					enabled: true
				}
			},
			session: {
				expiresIn: Duration.toSeconds("30 days")
			},
			advanced: {
				database: {
					generateId: () => v7()
				}
			}
		});

		return {
			auth,
			getAuthSession: Effect.fn("AuthService.getAuthSession")(function* () {
				const Users = yield* UserService;
				const event = getRequestEvent();

				const result = yield* Effect.tryPromise({
					try: () => auth.api.getSession({ headers: event.request.headers }),
					catch: (err) => new AuthError(err)
				});

				return {
					session: result?.session && (yield* parse(localsSessionSchema, result.session)),
					user: result?.user && (yield* Users.get.localsUser(result.user.id as UserId)),
					auth
				};
			}),
			guard: Effect.fn(function* (adminOnly = false) {
				const event = getRequestEvent();
				const user = event.locals.user;

				if (!user) {
					const returnUrl = `${event.url.pathname}${event.url.search}`;
					return yield* new RedirectError({
						message: "User is not authenticated",
						redirectTo: `/?redirect=${encodeURIComponent(returnUrl)}`
					});
				}

				const result = v.safeParse(localsUserSchema, user);
				if (!result.success) return yield* new InvalidUser(result.issues);

				if (result.output.banned) {
					return yield* new RedirectError({
						message: "Banned",
						redirectTo: "/"
					});
				}

				if (adminOnly && result.output.role !== "admin") {
					return yield* new RedirectError({
						message: "Insufficient permissions",
						redirectTo: "/characters"
					});
				}

				return { user: result.output, event };
			})
		};
	})
}) {}

export function getHomeError() {
	const event = getRequestEvent();
	const error = event.url.searchParams.get("error");
	const description = event.url.searchParams.get("error_description");

	if (isDefined(error)) {
		return {
			message: description,
			code: error.toUpperCase()
		};
	}

	return null;
}
