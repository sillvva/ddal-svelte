import { getRequestEvent } from "$app/server";
import { privateEnv } from "$lib/env/private";
import { localsSessionSchema, localsUserSchema, type LocalsUser, type UserId } from "$lib/schemas";
import { redirect, type NumericRange } from "@sveltejs/kit";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { passkey } from "better-auth/plugins/passkey";
import { Data, Effect } from "effect";
import { v7 } from "uuid";
import * as v from "valibot";
import { db } from "./db";
import { AppLog, runOrThrow, type ErrorParams } from "./effect";
import { withUser } from "./effect/users";

export const auth = betterAuth({
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

export function assertUser(user: LocalsUser | undefined): asserts user is LocalsUser {
	const event = getRequestEvent();
	const url = event.url;
	const result = v.safeParse(localsUserSchema, user);
	if (!result.success) {
		Effect.runFork(AppLog.debug("assertUser", { issues: v.summarize(result.issues) }));
		redirect(302, `/?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
	}
	if (result.output.banned) {
		event.cookies
			.getAll()
			.filter((c) => c.name.includes("auth"))
			.forEach((c) => event.cookies.delete(c.name, { path: "/" }));
		redirect(302, `/?code=BANNED&reason=${result.output.banReason}`);
	}
}

export async function getAuthSession(event = getRequestEvent()) {
	const { session, user } = (await auth.api.getSession({ headers: event.request.headers })) ?? {};

	return {
		session: session && v.parse(localsSessionSchema, session),
		user: user && (await runOrThrow(withUser((service) => service.get.localsUser(user.id as UserId))))
	};
}

export const assertAuth = Effect.fn(function* (adminOnly: boolean = false) {
	const event = getRequestEvent();
	const user = event.locals.user;
	assertUser(user);

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
