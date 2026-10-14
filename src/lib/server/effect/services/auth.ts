import { BLANK_CHARACTER, PASSKEY_PLACEHOLDER_EMAIL_DOMAIN } from "#lib/constants.js";
import { privateEnv } from "#lib/env/private.js";
import { localsSessionSchema, localsUserSchema, type UserId } from "#lib/schemas.js";
import { DBService } from "#lib/server/db/index.js";
import * as schema from "#lib/server/db/schema.js";
import { RedirectError, type ErrorParams } from "#lib/server/effect/errors.js";
import { getRequestEvent } from "$app/server";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { getAuthenticatorName, passkey } from "@better-auth/passkey";
import { isDefined } from "@sillvva/utils";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { lastLoginMethod } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { Context, Data, Duration, Effect, Layer } from "effect";
import { v7 } from "uuid";
import * as v from "valibot";
import { parse } from "../util";
import { UserService } from "./users";

const PASSKEY_SIGNUP_NAME = "New Adventurer";

/** `"admin"` requires an admin. `"onboarding"` allows only unfinished passkey signups. `null` is any signed-in user. */
export type GuardAccess = "admin" | "onboarding" | null;

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

const authenticate = Effect.fn("AuthService.authenticate")(function* () {
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

	return { user: result.output, event };
});

export class AuthService extends Context.Service<AuthService>()("AuthService", {
	make: Effect.fn("AuthService")(function* () {
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
			plugins: [
				passkey({
					registration: {
						requireSession: false,
						resolveUser: () => {
							if (privateEnv.DISABLE_SIGNUPS) {
								throw new APIError("FORBIDDEN", { message: "New accounts are disabled" });
							}

							const id = v7();
							return {
								id,
								name: "Adventurers League Log Sheet",
								displayName: "Adventurers League Log Sheet"
							};
						},
						afterVerification: async ({ user, verification }) => {
							const existing = await db.query.user.findFirst({
								where: { id: { eq: user.id as UserId } }
							});

							if (!existing) {
								if (privateEnv.DISABLE_SIGNUPS) {
									throw new APIError("FORBIDDEN", { message: "New accounts are disabled" });
								}

								await db.insert(schema.user).values({
									id: user.id as UserId,
									name: PASSKEY_SIGNUP_NAME,
									email: `${user.id}@${PASSKEY_PLACEHOLDER_EMAIL_DOMAIN}`,
									emailVerified: false,
									image: BLANK_CHARACTER,
									onboarded: false
								});
							}

							return {
								name: getAuthenticatorName(verification.registrationInfo?.aaguid) ?? "Passkey"
							};
						}
					}
				}),
				admin(),
				lastLoginMethod(),
				sveltekitCookies(getRequestEvent)
			],
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
			guard: Effect.fn(function* (access: GuardAccess = null) {
				const auth = yield* authenticate();

				if (auth.user.banned) {
					return yield* new RedirectError({
						message: "Banned",
						redirectTo: "/"
					});
				}

				if (access === "onboarding" && auth.user.onboarded) {
					return yield* new RedirectError({
						message: "Account already onboarded",
						redirectTo: "/characters"
					});
				}

				if (access !== "onboarding" && !auth.user.onboarded) {
					return yield* new RedirectError({
						message: "Finish creating your account",
						redirectTo: "/onboarding"
					});
				}

				if (access === "admin" && auth.user.role !== "admin") {
					return yield* new RedirectError({
						message: "Insufficient permissions",
						redirectTo: "/characters"
					});
				}

				return auth;
			}),

			/**
			 * Queries
			 */
			get: {
				session: Effect.fn("AuthService.get.session")(function* () {
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
				accounts: Effect.fn("AuthService.get.accounts")(function* () {
					const event = getRequestEvent();
					const user = event.locals.user;

					const tasks =
						user?.accounts.map(({ id, providerId }) =>
							Effect.promise(() =>
								auth.api
									.accountInfo({
										headers: event.request.headers,
										query: {
											accountId: id
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
				})
			}
		};
	})()
}) {
	static readonly layer = Layer.effect(this, this.make);
}

export function getHomeError(error: string | null, description: string | null) {
	if (isDefined(error)) {
		return {
			message: description,
			code: error.toUpperCase()
		};
	}

	return null;
}
