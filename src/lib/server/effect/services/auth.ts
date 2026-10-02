import { getRequestEvent } from "$app/server";
import { privateEnv } from "#lib/env/private.js";
import { localsSessionSchema, localsUserSchema, type UserId } from "#lib/schemas.js";
import { DBService } from "#lib/server/db/index.js";
import * as schema from "#lib/server/db/schema.js";
import { RedirectError, type ErrorParams } from "#lib/server/effect/errors.js";
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
				provider: "pg",
				schema: schema
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
			getAccounts: Effect.fn("AuthService.getAccounts")(function* () {
				const event = getRequestEvent();
				const user = event.locals.user;

				const tasks =
					user?.accounts.map(({ accountId, providerId }) =>
						Effect.promise(() =>
							auth.api
								.accountInfo({
									headers: event.request.headers,
									query: {
										accountId: accountId
									}
								})
								.then((r) =>
									r?.user?.name && r.user?.email && r.user?.image
										? {
												providerId,
												name: r?.user.name,
												email: r?.user.email,
												image: r?.user.image
											}
										: undefined
								)
						)
					) ?? [];

				const result = yield* Effect.all(tasks);
				return result.filter(isDefined);
			}),
			guard: Effect.fn(function* (adminOnly = false) {
				const event = getRequestEvent();
				const user = event.locals.user;

				if (!user) {
					const returnUrl = event.locals.requestPath;
					const safe = returnUrl.startsWith("/") && !returnUrl.startsWith("//") ? returnUrl : "/characters";
					return yield* new RedirectError({
						message: "User is not authenticated",
						redirectTo: `/?redirect=${encodeURIComponent(safe)}`
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

export function getHomeError(error: string | null, description: string | null) {
	if (isDefined(error)) {
		return {
			message: description,
			code: error.toUpperCase()
		};
	}

	return null;
}
