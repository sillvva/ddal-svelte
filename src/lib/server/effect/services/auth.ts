import { getRequestEvent } from "$app/server";
import { privateEnv } from "$lib/env/private";
import { localsSessionSchema, localsUserSchema, type LocalsSession, type LocalsUser, type UserId } from "$lib/schemas";
import { DBService, DrizzleError } from "$lib/server/db";
import { RedirectError, type ErrorParams } from "$lib/server/effect/errors";
import { isDefined } from "@sillvva/utils";
import type { RequestEvent } from "@sveltejs/kit";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { lastLoginMethod } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { passkey } from "better-auth/plugins/passkey";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { Data, Duration, Effect } from "effect";
import { v7 } from "uuid";
import * as v from "valibot";
import { parse, type InvalidSchemaError } from "../forms";
import { UserService } from "./users";

const authPlugins = [passkey(), admin(), lastLoginMethod(), sveltekitCookies(getRequestEvent)];

interface AuthApiImpl {
	readonly auth: () => Effect.Effect<ReturnType<typeof betterAuth<{ plugins: typeof authPlugins }>>>;
	readonly getAuthSession: () => Effect.Effect<
		{ session: LocalsSession | undefined; user: LocalsUser | undefined },
		DrizzleError | InvalidSchemaError<typeof localsSessionSchema> | AuthError,
		UserService
	>;
	readonly guard: (adminOnly?: boolean) => Effect.Effect<{ user: LocalsUser; event: RequestEvent }, RedirectError | InvalidUser>;
}

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
	effect: Effect.fn("AuthService")(function* () {
		const { db } = yield* DBService;

		const impl: AuthApiImpl = {
			auth: Effect.fn("AuthService.auth")(function* () {
				return betterAuth({
					appName: "Adventurers League Log Sheet",
					database: drizzleAdapter(db, {
						provider: "pg"
					}),
					secret: privateEnv.AUTH_SECRET,
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
					plugins: authPlugins,
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
			}),
			getAuthSession: Effect.fn("AuthService.getAuthSession")(function* () {
				const Users = yield* UserService;
				const event = getRequestEvent();

				const auth = yield* impl.auth();
				const result = yield* Effect.tryPromise({
					try: () => auth.api.getSession({ headers: event.request.headers }),
					catch: (err) => new AuthError(err)
				});

				return {
					session: result?.session && (yield* parse(localsSessionSchema, result.session)),
					user: result?.user && (yield* Users.get.localsUser(result.user.id as UserId))
				};
			}),
			guard: Effect.fn(function* (adminOnly = false) {
				const event = getRequestEvent();
				const user = event.locals.user;

				if (!user) {
					const returnUrl =
						event.route.id === null || event.url.pathname === "/"
							? (event.request.headers.get("referer")?.replace(event.url.origin, "") ?? "/characters")
							: `${event.url.pathname}${event.url.search}`;

					return yield* new RedirectError({
						message: "Invalid user",
						redirectTo: `/?redirect=${encodeURIComponent(returnUrl)}`
					});
				}

				const result = v.safeParse(localsUserSchema, user);
				if (!result.success) return yield* new InvalidUser(result.issues);

				if (result.output.banned) {
					event.cookies
						.getAll()
						.filter((c) => c.name.includes("auth"))
						.forEach((c) => event.cookies.delete(c.name, { path: "/" }));
					event.cookies.set("banned", result.output.banReason || "", { path: "/" });
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

		return impl;
	}),
	dependencies: [DBService.Default()]
}) {}

export function getHomeError() {
	const event = getRequestEvent();

	const banned = event.cookies.get("banned");
	if (isDefined(banned)) {
		return {
			message: `You have been banned from the application.${banned ? ` Reason: ${banned}` : ""}`,
			code: "BANNED" as const
		};
	}

	return null;
}
