import { getRequestEvent } from "$app/server";
import { privateEnv } from "$lib/env/private";
import { localsSessionSchema, localsUserSchema, type LocalsSession, type LocalsUser, type UserId } from "$lib/schemas";
import { DBService, DrizzleError, type Database } from "$lib/server/db";
import { RedirectError, type ErrorParams } from "$lib/server/effect/errors";
import { AppLog } from "$lib/server/effect/logging";
import { isDefined } from "@sillvva/utils";
import { type NumericRange } from "@sveltejs/kit";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { passkey } from "better-auth/plugins/passkey";
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
		plugins: [passkey(), admin()],
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

export const assertAuth = Effect.fn(function* ({
	adminOnly = false,
	redirect = false
}: { adminOnly?: boolean; redirect?: boolean } = {}) {
	const event = getRequestEvent();
	const user = event.locals.user;
	const url = event.url;
	const result = v.safeParse(localsUserSchema, user);

	if (!result.success) {
		if (user) yield* AppLog.debug("assertUser", { issues: v.summarize(result.issues) });
		if (redirect) {
			return yield* new RedirectError("Invalid user", `/?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`, 302);
		} else {
			return yield* new UnauthorizedError("Invalid user", 401, result.issues);
		}
	}

	if (result.output.banned) {
		event.cookies
			.getAll()
			.filter((c) => c.name.includes("auth"))
			.forEach((c) => event.cookies.delete(c.name, { path: "/" }));
		event.cookies.set("banned", result.output.banReason || "", { path: "/" });
		if (redirect) {
			return yield* new RedirectError("Banned", "/", 302);
		} else {
			return yield* new UnauthorizedError("Banned", 403);
		}
	}

	if (adminOnly && result.output.role !== "admin") {
		if (redirect) {
			return yield* new RedirectError("Insufficient permissions", "/characters", 302);
		} else {
			return yield* new UnauthorizedError("Insufficient permissions", 403);
		}
	}

	return { user: result.output, event };
});

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<ErrorParams> {
	constructor(message = "Unauthorized", status: NumericRange<400, 499>, cause?: unknown) {
		super({ message, status, cause });
	}
}

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
