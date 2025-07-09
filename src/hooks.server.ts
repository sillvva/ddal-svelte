import { privateEnv } from "$lib/env/private";
import { appCookieSchema, type UserId } from "$lib/schemas";
import { serverGetCookie } from "$server/cookie";
import { db } from "$server/db";
import { createId } from "@paralleldrive/cuid2";
import { type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { passkey } from "better-auth/plugins/passkey";
import { svelteKitHandler } from "better-auth/svelte-kit";

export const auth = betterAuth({
	appName: "Adventurers League Log Sheet",
	database: drizzleAdapter(db, {
		provider: "pg"
	}),
	socialProviders: {
		google: {
			clientId: privateEnv.GOOGLE_CLIENT_ID,
			clientSecret: privateEnv.GOOGLE_CLIENT_SECRET
		},
		discord: {
			clientId: privateEnv.DISCORD_CLIENT_ID,
			clientSecret: privateEnv.DISCORD_CLIENT_SECRET
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
			generateId: () => createId()
		}
	}
});

const authHandler: Handle = async ({ event, resolve }) => {
	return svelteKitHandler({ event, resolve, auth });
};

const session: Handle = async ({ event, resolve }) => {
	const session = await auth.api
		.getSession({
			headers: event.request.headers
		})
		.catch(() => null);

	const accounts = await db.query.account.findMany({
		where: {
			userId: {
				eq: session?.user.id as UserId
			}
		}
	});

	const passkeys = await db.query.passkey.findMany({
		columns: {
			id: true,
			name: true,
			createdAt: true
		},
		where: {
			userId: {
				eq: session?.user.id as UserId
			}
		}
	});

	event.locals.session = session && {
		...session.session,
		userId: session.session.userId as UserId,
		user: {
			...session.user,
			id: session.user.id as UserId,
			accounts,
			passkeys
		}
	};

	const response = await resolve(event);
	return response;
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
