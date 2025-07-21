import { building } from "$app/environment";
import { privateEnv } from "$lib/env/private";
import { appCookieSchema, localsSessionSchema, type UserId } from "$lib/schemas";
import { serverGetCookie } from "$server/cookie";
import { db } from "$server/db";
import { run } from "$server/effect";
import { withUser } from "$server/effect/user";
import { type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { passkey } from "better-auth/plugins/passkey";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { v7 } from "uuid";
import { parse } from "valibot";

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
	plugins: [passkey()],
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

const authHandler: Handle = async ({ event, resolve }) => {
	return svelteKitHandler({ event, resolve, auth, building });
};

const session: Handle = async ({ event, resolve }) => {
	if (!event.route.id) return await resolve(event);

	const { session, user } = (await auth.api.getSession({ headers: event.request.headers })) ?? {};

	event.locals.session = session && parse(localsSessionSchema, session);
	event.locals.user = user && (await run(withUser((service) => service.getLocalsUser(user.id as UserId))));

	return await resolve(event);
};

const preloadTheme: Handle = async ({ event, resolve }) => {
	const app = serverGetCookie("app", appCookieSchema);
	const mode = app.settings.mode;
	const theme = event.route.id?.startsWith("/(app)") ? app.settings.theme : app.settings.mode;

	return await resolve(event, {
		transformPageChunk: ({ html }) => {
			return html.replace(/%theme%/g, `class="${mode}" data-theme="${theme}"`);
		}
	});
};

export const handle = sequence(authHandler, session, preloadTheme);
