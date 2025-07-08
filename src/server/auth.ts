import { privateEnv } from "$lib/env/private";
import type { Prettify } from "@sillvva/utils";
import { redirect } from "@sveltejs/kit";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { passkey } from "better-auth/plugins/passkey";
import { db } from "./db";

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
	}
});

function urlRedirect(url: URL) {
	return `redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`;
}

export function assertUser<T extends User>(
	user: T | undefined,
	redirectUrl: URL
): asserts user is Prettify<T & LocalsSession["user"]> {
	if (!user || !user.id || !user.name || !user.email) redirect(302, `/?${urlRedirect(redirectUrl)}`);
}
