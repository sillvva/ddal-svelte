import { getRequestEvent } from "$app/server";
import { privateEnv } from "$lib/env/private";
import {
	InvalidSchemaError,
	localsSessionSchema,
	localsUserSchema,
	parse,
	type LocalsSession,
	type LocalsUser,
	type UserId
} from "$lib/schemas";
import { DBService, DrizzleError } from "$lib/server/db";
import { type ErrorParams } from "$lib/server/effect/errors";
import { AppLog } from "$lib/server/effect/logging";
import { redirect, type NumericRange } from "@sveltejs/kit";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { passkey } from "better-auth/plugins/passkey";
import { Data, Effect } from "effect";
import { v7 } from "uuid";
import * as v from "valibot";
import { UserService } from "./users";

interface AuthApiImpl {
	readonly auth: () => Effect.Effect<ReturnType<typeof betterAuth>>;
	readonly getAuthSession: () => Effect.Effect<
		{ session: LocalsSession | undefined; user: LocalsUser | undefined },
		DrizzleError | InvalidSchemaError | AuthError,
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
				return betterAuth({
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
						expiresIn: 60 * 60 * 24 * 30 // 30 days
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
			})
		};

		return impl;
	}),
	dependencies: [DBService.Default()]
}) {}

export const assertUser = Effect.fn(function* (user: LocalsUser | undefined) {
	const event = getRequestEvent();
	const url = event.url;
	const result = v.safeParse(localsUserSchema, user);

	if (!result.success) {
		yield* AppLog.debug("assertUser", { issues: v.summarize(result.issues) });
		redirect(302, `/?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
	}

	if (result.output.banned) {
		event.cookies
			.getAll()
			.filter((c) => c.name.includes("auth"))
			.forEach((c) => event.cookies.delete(c.name, { path: "/" }));
		redirect(302, `/?code=BANNED&reason=${result.output.banReason}`);
	}

	return result.output;
});

export const assertAuthOrRedirect = Effect.fn(function* (adminOnly: boolean = false) {
	const event = getRequestEvent();
	const user = yield* assertUser(event.locals.user);

	if (adminOnly && user.role !== "admin") return redirect(302, "/characters");

	return user;
});

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<ErrorParams> {
	constructor(message = "Unauthorized", status: NumericRange<400, 499>) {
		super({ message, status });
	}
}

export const assertAuthOrFail = Effect.fn(function* (adminOnly: boolean = false) {
	const event = getRequestEvent();
	const user = event.locals.user;
	if (!user) return yield* Effect.fail(new UnauthorizedError("Authentication required", 401));

	if (adminOnly && user.role !== "admin") return yield* Effect.fail(new UnauthorizedError("Insufficient permissions", 403));

	return user;
});

export function getError(code: string | null, reason: string | null) {
	switch (code) {
		case "BANNED":
			return { message: `You have been banned from the application.${reason ? ` Reason: ${reason}` : ""}`, code };
	}
	return null;
}
