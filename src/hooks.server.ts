import { privateEnv } from "$lib/env/private";
import { appCookieSchema, type UserId } from "$lib/schemas";
import { updateAccount } from "$server/actions/users";
import { serverGetCookie } from "$server/cookie";
import { db, q } from "$server/db";
import { accounts, authenticators, sessions, users, type Account } from "$server/db/schema";
import type { Provider } from "@auth/core/providers";
import Discord from "@auth/core/providers/discord";
import Google from "@auth/core/providers/google";
import WebAuthn from "@auth/core/providers/webauthn";
import type { Profile, TokenSet } from "@auth/core/types";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { SvelteKitAuth, type SvelteKitAuthConfig } from "@auth/sveltekit";
import { type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { eq } from "drizzle-orm";
import { assertUser, CustomAuthError } from "./server/auth";

interface OAuthProvider {
	id: string;
	tokenUrl: string;
	clientId: string;
	clientSecret: string;
	profile: (profile: Profile) => {
		id: string;
		name: string;
		image: string;
	} | null;
	oauth: () => Provider;
}
const providers: OAuthProvider[] = [
	{
		id: "google",
		tokenUrl: "https://oauth2.googleapis.com/token",
		clientId: privateEnv.GOOGLE_CLIENT_ID,
		clientSecret: privateEnv.GOOGLE_CLIENT_SECRET,
		profile: function (profile) {
			if (!profile.sub) return null;
			return {
				id: profile.sub,
				name: profile.name as string,
				image: profile.picture as string
			};
		},
		oauth: function () {
			return Google({
				clientId: this.clientId,
				clientSecret: this.clientSecret,
				authorization: { params: { access_type: "offline", prompt: "consent" } }
			});
		}
	},
	{
		id: "discord",
		tokenUrl: "https://discord.com/api/v10/oauth2/token",
		clientId: privateEnv.DISCORD_CLIENT_ID,
		clientSecret: privateEnv.DISCORD_CLIENT_SECRET,
		profile: function (profile) {
			if (!profile.id) return null;
			return {
				id: profile.id,
				name: profile.global_name as string,
				image: profile.image_url as string
			};
		},
		oauth: function () {
			return Discord({
				clientId: this.clientId,
				clientSecret: this.clientSecret
			});
		}
	}
];

const auth = SvelteKitAuth(async (event) => {
	const redirectTo = event.url.searchParams.get("redirect") || "/characters";
	const redirectUrl = new URL(redirectTo, event.url.origin);

	return {
		callbacks: {
			async signIn({ account, user, profile }) {
				try {
					if (!user) throw new CustomAuthError("NotAuthenticated");
					if (!account) throw new CustomAuthError("MissingAccountData");
					if (!profile) throw new CustomAuthError("MissingProfileData");

					if (account.provider === "webauthn") return true;
					const provider = providers.find((p) => p.id === account.provider);
					if (!provider) throw new CustomAuthError("InvalidProvider", account.provider);

					const accountProfile = provider.profile(profile);
					if (!accountProfile) throw new CustomAuthError("ProfileNotFound");

					const currentSession = await event.locals.auth();
					const currentUserId = currentSession?.user?.id;
					if (currentUserId) return true;

					const existingAccount = await q.accounts.findFirst({
						where: {
							provider: {
								eq: account.provider
							},
							providerAccountId: {
								eq: account.providerAccountId
							}
						}
					});

					if (privateEnv.DISABLE_SIGNUPS && !existingAccount) throw new CustomAuthError("SignupsDisabled");

					event.cookies.set("provider", account.provider, {
						path: "/",
						expires: new Date(Date.now() + 365 * 86400 * 1000),
						httpOnly: true
					});

					const { userId, ...rest } = account;
					if (existingAccount)
						await updateAccount({
							...rest,
							lastLogin: new Date()
						});

					if (user.name !== accountProfile.name || user.image !== accountProfile.image) {
						await db
							.update(users)
							.set({ name: accountProfile.name, image: accountProfile.image })
							.where(eq(users.id, user.id as UserId));
					}

					return true;
				} catch (err) {
					if (err instanceof CustomAuthError) {
						event.cookies.delete("provider", { path: "/" });
						return err.redirect(redirectUrl);
					} else throw err;
				}
			},
			async session({ session }) {
				assertUser(session.user, redirectUrl);

				const provider = event.cookies.get("provider");
				if (provider && session.expires.getTime() - Date.now() >= 15 * 86400 * 1000) return session satisfies LocalsSession;

				const account = await q.accounts.findFirst({
					where: {
						userId: {
							eq: session.user.id
						},
						lastLogin: {
							isNotNull: true
						},
						provider: provider
							? {
									eq: provider
								}
							: {
									ne: "webauthn"
								}
					},
					orderBy: {
						lastLogin: "desc"
					}
				});

				if (account) {
					event.cookies.set("provider", account.provider, {
						path: "/",
						expires: new Date(Date.now() + 365 * 86400 * 1000),
						httpOnly: true
					});

					// Refresh OAuth access token
					if (providers.some((p) => p.id === account.provider)) {
						const result = await refreshToken(account);
						if (result instanceof Error) console.error(`RefreshAccessTokenError: ${result.message}`);
					}

					const newDate = new Date(Date.now() + 30 * 86400 * 1000);
					await db.update(sessions).set({ expires: newDate }).where(eq(sessions.sessionToken, session.sessionToken));
				}

				return session satisfies LocalsSession;
			}
		},
		secret: privateEnv.AUTH_SECRET,
		adapter: DrizzleAdapter(db as any, {
			usersTable: users,
			accountsTable: accounts,
			sessionsTable: sessions,
			authenticatorsTable: authenticators
		}),
		experimental: {
			enableWebAuthn: true
		},
		providers: providers.map((p) => p.oauth()).concat(WebAuthn),
		trustHost: true,
		pages: {
			signIn: "/",
			error: "/"
		}
	} satisfies SvelteKitAuthConfig;
});

const session: Handle = async ({ event, resolve }) => {
	event.locals.session = await event.locals.auth();

	const cookies = event.cookies.getAll();
	const cSession = cookies.find((c) => c.name.includes("session-token"));
	if (cSession)
		event.cookies.set(cSession.name, cSession.value, {
			expires: new Date(Date.now() + 30 * 86400 * 1000),
			httpOnly: true,
			path: "/"
		});

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

export const handle = sequence(auth.handle, session, preloadTheme);

async function refreshToken(account: Account) {
	try {
		const provider = providers.find((p) => p.id === account.provider);
		if (!provider) throw new Error(`Provider '${account.provider}' not found`);
		if (!account.refresh_token) throw new Error("No refresh token");

		if (!account.expires_at || account.expires_at * 1000 < Date.now()) {
			const response = await fetch(provider.tokenUrl, {
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					client_id: provider.clientId,
					client_secret: provider.clientSecret,
					grant_type: "refresh_token",
					refresh_token: account.refresh_token
				}),
				method: "POST"
			});

			const token = (await response.json()) as TokenSet;

			if (!response.ok) {
				console.error("Error refreshing access token:", token);
				throw new Error("See logs for details");
			}

			if (token) {
				if (!token.expires_in && !token.expires_at) throw new Error("No expiration in token response");
				return await updateAccount(account);
			}
		}

		return;
	} catch (err) {
		if (err instanceof Error) return err;
		else {
			console.error(err);
			return new Error("Unknown error. See logs for details");
		}
	}
}
