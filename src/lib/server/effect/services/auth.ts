import { BLANK_CHARACTER, PASSKEY_PLACEHOLDER_EMAIL_DOMAIN, PROVIDERS } from "#lib/constants.js";
import { privateEnv } from "#lib/env/private.js";
import { emailSchema, localsSessionSchema, localsUserSchema, type UserId } from "#lib/schemas.js";
import { DBService, runQuery } from "#lib/server/db/index.js";
import type { User } from "#lib/server/db/schema.js";
import * as schema from "#lib/server/db/schema.js";
import { RedirectError, type ErrorParams } from "#lib/server/effect/errors.js";
import { AppLog } from "#lib/server/effect/logging.js";
import { getRequestEvent } from "$app/server";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { getAuthenticatorName, passkey } from "@better-auth/passkey";
import { isDefined, isTupleOf } from "@sillvva/utils";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { lastLoginMethod } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { and, eq, exists, ne, or, sql } from "drizzle-orm";
import { Context, Data, Duration, Effect, Layer } from "effect";
import { v7 } from "uuid";
import * as v from "valibot";
import { parse } from "../util";

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

export class UpdateUserError extends Data.TaggedError("UpdateUserError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Could not update user", status: 500, cause: err });
	}
}

export class DeleteUserError extends Data.TaggedError("DeleteUserError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Could not delete account", status: 500, cause: err });
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
		const { db, transaction } = yield* DBService;

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
			api: auth.api,
			guard: Effect.fn("AuthService.guard")(function* (access: GuardAccess = null) {
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
					const event = getRequestEvent();

					const result = yield* Effect.tryPromise({
						try: () => auth.api.getSession({ headers: event.request.headers }),
						catch: (err) => new AuthError(err)
					});

					return {
						session: result?.session && (yield* parse(localsSessionSchema, result.session)),
						user:
							result?.user &&
							(yield* runQuery(
								db.query.user.findFirst({
									with: {
										accounts: {
											columns: {
												id: true,
												accountId: true,
												providerId: true,
												scope: true,
												createdAt: true,
												updatedAt: true
											},
											where: {
												providerId: {
													in: PROVIDERS.map((p) => p.id)
												}
											}
										},
										passkeys: {
											columns: {
												id: true,
												name: true,
												createdAt: true
											}
										}
									},
									where: {
										id: {
											eq: result.user.id as UserId
										}
									}
								})
							)),
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
										r.user.name && r.user.email && r.user.image
											? {
													id,
													providerId,
													name: r.user.name,
													email: r.user.email,
													image: r.user.image
												}
											: undefined
									)
							)
						) ?? [];

					const result = yield* Effect.all(tasks);
					return result.filter(isDefined);
				}),
				emailTaken: Effect.fn("AuthService.get.emailTaken")(function* (email: string, userId: UserId) {
					const matches = yield* runQuery(
						db
							.select({ id: schema.user.id })
							.from(schema.user)
							.where(and(sql`lower(${schema.user.email}) = ${email.toLowerCase()}`, ne(schema.user.id, userId)))
							.limit(1)
					);
					return matches.length > 0;
				})
			},

			/**
			 * Mutations
			 */
			completeOnboarding: Effect.fn("AuthService.completeOnboarding")(function* (
				userId: UserId,
				data: Pick<User, "name" | "email">
			) {
				const parsed = v.safeParse(emailSchema, data.email);
				if (!parsed.success) return yield* new UpdateUserError("Enter a valid email address");
				const email = parsed.output;

				return yield* runQuery(
					db
						.update(schema.user)
						.set({ name: data.name.trim(), email, onboarded: true })
						.where(and(eq(schema.user.id, userId), eq(schema.user.onboarded, false)))
						.returning()
				).pipe(
					Effect.flatMap((users) =>
						isTupleOf(users, 1) ? Effect.succeed(users[0]) : Effect.fail(new UpdateUserError("Failed to finish account setup"))
					),
					Effect.tap((result) => AppLog.info("AuthService.completeOnboarding", { userId, result })),
					Effect.tapError(() => AppLog.debug("AuthService.completeOnboarding", { userId, data }))
				);
			}),
			user: {
				update: Effect.fn("AuthService.user.update")(function* (userId: UserId, data: Partial<Pick<User, "name" | "image">>) {
					return yield* runQuery(db.update(schema.user).set(data).where(eq(schema.user.id, userId)).returning()).pipe(
						Effect.flatMap((users) =>
							isTupleOf(users, 1) ? Effect.succeed(users[0]) : Effect.fail(new UpdateUserError("Failed to update user"))
						),
						Effect.tap((result) => AppLog.info("AuthService.user.update", { userId, result })),
						Effect.tapError(() => AppLog.debug("AuthService.user.update", { userId, data }))
					);
				}),
				delete: Effect.fn("AuthService.user.delete")(function* (userId: UserId) {
					return yield* transaction(
						Effect.fn(function* (tx) {
							// Logs reference dungeon masters with ON DELETE RESTRICT, so they must go before the user row.
							yield* runQuery(
								tx.delete(schema.logs).where(
									or(
										exists(
											db
												.select()
												.from(schema.dungeonMasters)
												.where(
													and(eq(schema.dungeonMasters.id, schema.logs.dungeonMasterId), eq(schema.dungeonMasters.userId, userId))
												)
										),
										exists(
											db
												.select()
												.from(schema.characters)
												.where(and(eq(schema.characters.id, schema.logs.characterId), eq(schema.characters.userId, userId)))
										)
									)
								)
							);

							return yield* runQuery(tx.delete(schema.user).where(eq(schema.user.id, userId)).returning({ id: schema.user.id }));
						})
					).pipe(
						Effect.flatMap((result) => (isTupleOf(result, 1) ? Effect.succeed(result[0]) : Effect.fail(new DeleteUserError()))),
						Effect.tap((result) => AppLog.info("AuthService.user.delete", { userId, result })),
						Effect.tapError(() => AppLog.debug("AuthService.user.delete", { userId }))
					);
				})
			}
		};
	})()
}) {
	static readonly layer = Layer.effect(this, this.make);
}
