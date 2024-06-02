import { privateEnv } from "$lib/env/private";
import type { UserId } from "$lib/schemas";
import { updateAccount } from "$server/actions/users";
import { db, q } from "$server/db";
import { accounts, authenticators, sessions, users, type Account, type InsertAuthenticator } from "$server/db/schema";
import type { AdapterAccount } from "@auth/core/adapters";
import type { Provider } from "@auth/core/providers";
import Discord from "@auth/core/providers/discord";
import Google from "@auth/core/providers/google";
import WebAuthn from "@auth/core/providers/webauthn";
import type { Profile, TokenSet } from "@auth/core/types";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { SvelteKitAuth, type SvelteKitAuthConfig } from "@auth/sveltekit";
import { type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { handle as documentHandle } from "@sveltekit-addons/document/hooks";
import { and, eq, ne } from "drizzle-orm";
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

					const provider = providers.find((p) => p.id === account.provider);
					if (!provider) throw new CustomAuthError("InvalidProvider", account.provider);

					const accountProfile = provider.profile(profile);
					if (!accountProfile) throw new CustomAuthError("ProfileNotFound");

					const currentSession = await event.locals.auth();
					const currentUserId = currentSession?.user?.id;
					if (currentUserId) return true;

					const existingAccount = await q.accounts.findFirst({
						where: (accounts, { and, eq }) =>
							and(eq(accounts.provider, account.provider), eq(accounts.providerAccountId, account.providerAccountId))
					});

					if (privateEnv.DISABLE_SIGNUPS && !existingAccount && !currentUserId) throw new CustomAuthError("SignupsDisabled");

					event.cookies.set("provider", account.provider, {
						path: "/",
						expires: new Date(Date.now() + 365 * 86400 * 1000),
						httpOnly: true
					});

					const { userId, ...rest } = account;
					if (existingAccount) await updateAccount(rest);

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
					where: (accounts, { and, eq, isNotNull }) =>
						and(
							eq(accounts.userId, session.user.id),
							isNotNull(accounts.lastLogin),
							provider ? eq(accounts.provider, provider) : ne(accounts.provider, "webauthn")
						),
					orderBy: (account, { desc }) => desc(account.lastLogin)
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
		adapter: {
			...DrizzleAdapter(db, {
				usersTable: users,
				accountsTable: accounts,
				sessionsTable: sessions
			}),
			async getAccount(providerAccountId: string, provider: string) {
				return db
					.select()
					.from(accounts)
					.where(and(eq(accounts.provider, provider), eq(accounts.providerAccountId, providerAccountId)))
					.then((res) => res[0] ?? null) as Promise<AdapterAccount | null>;
			},
			async createAuthenticator(data: InsertAuthenticator) {
				const authenticator = await db
					.insert(authenticators)
					.values(data)
					.returning()
					.then((res) => res[0]);

				if (!authenticator) throw new Error("Authenticator not created.");

				return authenticator;
			},
			async getAuthenticator(credentialID: string) {
				return await db
					.select()
					.from(authenticators)
					.where(eq(authenticators.credentialID, credentialID))
					.then((res) => res[0] ?? null);
			},
			async listAuthenticatorsByUserId(userId: UserId) {
				return await db
					.select()
					.from(authenticators)
					.where(eq(authenticators.userId, userId))
					.then((res) => res);
			},
			async updateAuthenticatorCounter(credentialID: string, newCounter: number) {
				const authenticator = await db
					.update(authenticators)
					.set({ counter: newCounter })
					.where(eq(authenticators.credentialID, credentialID))
					.returning()
					.then((res) => res[0]);

				if (!authenticator) throw new Error("Authenticator not found.");

				return authenticator;
			}
		},
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

export const handle = sequence(auth.handle, session, documentHandle);

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
