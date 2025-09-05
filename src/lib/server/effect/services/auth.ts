import { getRequestEvent } from "$app/server";
import { privateEnv } from "$lib/env/private";
import { localsSessionSchema, localsUserSchema, type LocalsSession, type LocalsUser, type UserId } from "$lib/schemas";
import { DBService, DrizzleError, type Database } from "$lib/server/db";
import { RedirectError, type ErrorParams } from "$lib/server/effect/errors";
import { AppLog } from "$lib/server/effect/logging";
import { isDefined } from "@sillvva/utils";
import { betterAuth, type BetterAuthOptions } from "better-auth";
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

const authConfig = (db: Database) =>
	({
		appName: "Adventurers League Log Sheet",
		database: drizzleAdapter(db, {
			provider: "pg"
		}),
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
	}) as const satisfies BetterAuthOptions;

interface AuthApiImpl {
	readonly auth: () => Effect.Effect<ReturnType<typeof betterAuth<ReturnType<typeof authConfig>>>>;
	readonly getAuthSession: () => Effect.Effect<
		{ session: LocalsSession | undefined; user: LocalsUser | undefined },
		DrizzleError | InvalidSchemaError | AuthError | RedirectError,
		UserService
	>;
}

class AuthError extends Data.TaggedError("AuthError")<ErrorParams> {
	constructor(err: unknown) {
		super({ message: "Authentication error", status: 500, cause: err });
	}
}

export class AuthService extends Effect.Service<AuthService>()("AuthService", {
	effect: Effect.fn("AuthService")(function* () {
		const { db } = yield* DBService;

		const impl: AuthApiImpl = {
			auth: Effect.fn("AuthService.auth")(function* () {
				return betterAuth(authConfig(db));
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
			})
		};

		return impl;
	}),
	dependencies: [DBService.Default()]
}) {}

export const assertAuth = Effect.fn(function* (adminOnly = false) {
	const event = getRequestEvent();
	const user = event.locals.user;
	const url = event.url;
	const result = v.safeParse(localsUserSchema, user);

	if (!result.success) {
		if (user) yield* AppLog.debug("assertUser", { issues: v.summarize(result.issues) });
		return yield* new RedirectError({
			message: "Invalid user",
			status: 302,
			cause: result.issues,
			redirectTo: `/?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`
		});
	}

	if (result.output.banned) {
		event.cookies
			.getAll()
			.filter((c) => c.name.includes("auth"))
			.forEach((c) => event.cookies.delete(c.name, { path: "/" }));
		event.cookies.set("banned", result.output.banReason || "", { path: "/" });
		return yield* new RedirectError({
			message: "Banned",
			status: 302,
			redirectTo: "/"
		});
	}

	if (adminOnly && result.output.role !== "admin") {
		return yield* new RedirectError({
			message: "Insufficient permissions",
			status: 302,
			redirectTo: "/characters"
		});
	}

	return { user: result.output, event };
});

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
