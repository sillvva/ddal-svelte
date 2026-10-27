import { BLANK_CHARACTER, PASSKEY_PLACEHOLDER_EMAIL_DOMAIN, PROVIDERS } from "#lib/constants.js";
import { ownedAvatarKey } from "#lib/images/object-key.js";
import { emailSchema, localsSessionSchema, localsUserSchema, type OnboardingSchema, type UserId } from "#lib/schemas.js";
import { DBService, runQuery } from "#lib/server/db/index.js";
import type { User } from "#lib/server/db/schema.js";
import * as schema from "#lib/server/db/schema.js";
import { AuthTokenError, RedirectError, type ErrorParams } from "#lib/server/effect/errors.js";
import { AppLog } from "#lib/server/effect/logging.js";
import { promoteStagedAvatar, StorageService } from "#lib/server/effect/services/storage.js";
import { ImageUploadError } from "#lib/server/images/errors.js";
import { clearScheduledDeletions, collectUserKeys, lockPortraitUser, scheduleDeletions } from "#lib/server/images/portrait-db.js";
import {
	AUTH_SECRET,
	DISABLE_SIGNUPS,
	DISCORD_CLIENT_ID,
	DISCORD_CLIENT_SECRET,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET
} from "$app/env/private";
import { PUBLIC_URL, R2_PUBLIC_URL } from "$app/env/public";
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
import { Context, Data, Duration, Effect, Layer, Result } from "effect";
import { v7 } from "uuid";
import * as v from "valibot";
import { parse } from "../util";

const PASSKEY_SIGNUP_NAME = "New Adventurer";

/**
 * `"admin"` requires a finished admin. `"onboarding"` allows only unfinished signups.
 * `"any"` allows a signed-in user whether or not onboarding is finished. `null` requires a finished account.
 */
export type GuardAccess = "admin" | "onboarding" | "any" | null;

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
			secret: AUTH_SECRET,
			baseURL: PUBLIC_URL,
			socialProviders: {
				google: {
					clientId: GOOGLE_CLIENT_ID,
					clientSecret: GOOGLE_CLIENT_SECRET,
					disableSignUp: DISABLE_SIGNUPS
				},
				discord: {
					clientId: DISCORD_CLIENT_ID,
					clientSecret: DISCORD_CLIENT_SECRET,
					disableSignUp: DISABLE_SIGNUPS
				}
			},
			plugins: [
				passkey({
					registration: {
						requireSession: false,
						resolveUser: () => {
							if (DISABLE_SIGNUPS) {
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
								if (DISABLE_SIGNUPS) {
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

				if (access !== "onboarding" && access !== "any" && !auth.user.onboarded) {
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
							Effect.tryPromise({
								try: () =>
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
										),
								catch: (error) => {
									// Check if this is a Better Auth token refresh error
									const isBetterAuthError =
										error instanceof APIError ||
										(typeof error === "object" &&
											error !== null &&
											"code" in error &&
											typeof error.code === "string" &&
											error.code === "FAILED_TO_GET_ACCESS_TOKEN");

									if (isBetterAuthError) {
										// Get provider name for error message
										const provider = PROVIDERS.find((p) => p.id === providerId);
										const providerName = provider?.name ?? "your OAuth provider";

										return new AuthTokenError(`Your session with ${providerName} has expired. Please sign in again.`, error);
									}

									// For other errors, return a generic error with context
									return new Error(`Failed to fetch account info for ${providerId}: ${String(error)}`);
								}
							}).pipe(
								// Log non-auth errors and convert them to undefined so we can skip them
								Effect.catchIf(
									(e) => !(e instanceof AuthTokenError),
									(error) =>
										AppLog.error("Failed to fetch account info", { id, providerId, error }).pipe(
											Effect.as(undefined as undefined)
										)
								)
							)
						) ?? [];

					// Run every account lookup and keep both successes and failures.
					const results = yield* Effect.all(tasks, { mode: "result" });

					// Check if any result is an AuthTokenError
					for (const result of results) {
						if (Result.isFailure(result) && result.failure instanceof AuthTokenError) {
							// Sign out the user
							yield* Effect.tryPromise(() =>
								auth.api.signOut({
									headers: event.request.headers
								})
							).pipe(Effect.ignore);

							// Redirect to login with error message
							return yield* new RedirectError({
								message: result.failure.message,
								redirectTo: `/?error=session_expired&error_description=${encodeURIComponent(result.failure.message)}`
							});
						}
					}

					// Filter successful results
					const accounts = results
						.filter(Result.isSuccess)
						.map((r) => r.success)
						.filter(isDefined);

					return accounts;
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
			completeOnboarding: Effect.fn("AuthService.completeOnboarding")(function* (userId: UserId, data: OnboardingSchema) {
				const parsed = v.safeParse(emailSchema, data.email);
				if (!parsed.success) return yield* new UpdateUserError("Enter a valid email address");
				const email = parsed.output;
				const profile = { name: data.name.trim(), email, onboarded: true };
				const whereUnfinished = and(eq(schema.user.id, userId), eq(schema.user.onboarded, false));

				const uploadId = data.uploadId;
				const saved = !uploadId
					? runQuery(db.update(schema.user).set(profile).where(whereUnfinished).returning())
					: Effect.gen(function* () {
							const Storage = yield* StorageService;
							const copied = { permanentKey: null as string | null };
							let temporaryKey: string | null = null;
							const rows = yield* transaction(
								Effect.fn(function* (tx) {
									yield* lockPortraitUser(tx, userId);
									const promoted = yield* promoteStagedAvatar(tx, userId, uploadId, copied);
									temporaryKey = promoted.temporaryKey;
									return yield* runQuery(
										tx
											.update(schema.user)
											.set({ ...profile, image: promoted.imageUrl })
											.where(whereUnfinished)
											.returning()
									);
								})
							).pipe(
								Effect.tapError(() => {
									const orphanKey = copied.permanentKey;
									if (!orphanKey) return Effect.void;
									return Storage.abandonStagedObject(userId, orphanKey).pipe(
										Effect.catch((error) =>
											AppLog.error("AuthService.completeOnboarding staged cleanup", { message: error.message })
										)
									);
								})
							);
							yield* Storage.cleanupAfterSave(temporaryKey);
							return rows;
						});

				return yield* saved.pipe(
					Effect.flatMap((users) =>
						isTupleOf(users, 1) ? Effect.succeed(users[0]) : Effect.fail(new UpdateUserError("Failed to finish account setup"))
					),
					Effect.tap((result) => AppLog.info("AuthService.completeOnboarding", { userId, result })),
					Effect.tapError(() => AppLog.debug("AuthService.completeOnboarding", { userId, data }))
				);
			}),
			user: {
				update: Effect.fn("AuthService.user.update")(function* (userId: UserId, data: Partial<Pick<User, "name" | "image">>) {
					const write =
						data.image === undefined
							? runQuery(db.update(schema.user).set(data).where(eq(schema.user.id, userId)).returning())
							: transaction(
									Effect.fn(function* (tx) {
										yield* lockPortraitUser(tx, userId);
										const rows = yield* runQuery(
											tx.select({ image: schema.user.image }).from(schema.user).where(eq(schema.user.id, userId)).limit(1)
										);
										const current = rows[0];
										if (!current) return yield* new UpdateUserError("Failed to update user");

										const previousKey = current.image ? ownedAvatarKey(userId, current.image, R2_PUBLIC_URL) : null;
										const nextKey = data.image ? ownedAvatarKey(userId, data.image, R2_PUBLIC_URL) : null;
										// A new avatar is stored only by the avatar save. Reject pointing the profile at some other object.
										if (nextKey && nextKey !== previousKey) {
											return yield* new ImageUploadError("Upload that image again before saving.");
										}
										if (previousKey && previousKey !== nextKey) yield* scheduleDeletions(tx, [previousKey]);
										if (nextKey) yield* clearScheduledDeletions(tx, [nextKey]);

										return yield* runQuery(tx.update(schema.user).set(data).where(eq(schema.user.id, userId)).returning());
									})
								);

					return yield* write.pipe(
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
							// Record permanent object keys before the user row (and its characters) disappear.
							const keys = yield* collectUserKeys(tx, userId);
							yield* scheduleDeletions(tx, keys);

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
