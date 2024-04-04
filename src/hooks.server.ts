import { PROVIDERS } from "$lib/constants";
import { privateEnv } from "$lib/env/private";
import type { UserId } from "$lib/schemas";
import { isDefined, joinStringList } from "$lib/util";
import { db, q } from "$server/db";
import { accounts, users, type Account } from "$server/db/schema";
import type { Provider } from "@auth/core/providers";
import Discord from "@auth/core/providers/discord";
import Google from "@auth/core/providers/google";
import type { Profile, TokenSet } from "@auth/core/types";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { SvelteKitAuth, type SvelteKitAuthConfig } from "@auth/sveltekit";
import { redirect, type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { handle as documentHandle } from "@sveltekit-addons/document/hooks";
import { and, eq } from "drizzle-orm";
import { authErrRedirect } from "./server/auth";

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
	return {
		callbacks: {
			async signIn({ account, user, profile }) {
				const redirectTo = event.url.searchParams.get("redirect") || undefined;
				const redirectUrl = redirectTo ? new URL(redirectTo, event.url.origin) : undefined;

				if (!account) authErrRedirect("Missing Account Data", "Account not found", redirectUrl);
				if (!profile) authErrRedirect("Missing Account Data", "Profile not found", redirectUrl);

				const provider = providers.find((p) => p.id === account.provider);
				if (!provider) authErrRedirect("Invalid Provider", `Provider '${account.provider}' not supported`, redirectUrl);

				const accountProfile = provider.profile(profile);
				if (!accountProfile) authErrRedirect("Profile Error", "Profile not found", redirectUrl);

				const existingAccount = await q.accounts.findFirst({
					where: (accounts, { and, eq }) =>
						and(eq(accounts.provider, account.provider), eq(accounts.providerAccountId, account.providerAccountId))
				});

				const currentSession = await event.locals.auth();
				const currentUserId = currentSession?.user?.id;

				if (privateEnv.DISABLE_SIGNUPS && !existingAccount && !currentUserId)
					authErrRedirect("Signups Disabled", "Signups are disabled", redirectUrl);

				if (currentUserId) {
					// If there is a user logged in already that we recognize,
					// and we have an account that is being signed in with
					// then we should link the account to the user

					// Only link accounts that have not yet been linked
					if (existingAccount) authErrRedirect("AccountLinkError", "Account already linked to a user", redirectUrl);

					// Do the account linking
					await db.insert(accounts).values({
						provider: account.provider,
						providerAccountId: account.providerAccountId,
						userId: currentUserId,
						type: account.type,
						accessToken: account.access_token ?? "",
						expiresAt: Math.floor(Date.now() / 1000 + (account.expires_in ?? 3600)),
						refreshToken: account.refresh_token,
						tokenType: `${account.token_type}`,
						scope: account.scope ?? "",
						idToken: account.id_token,
						lastLogin: new Date()
					});

					redirect(302, "/characters");
				} else if (existingAccount) {
					// If there is no user logged in, but we recognize the account
					// then we should log the user in and update the refresh token

					if (account.refresh_token && account.expires_in) {
						await db
							.update(accounts)
							.set({
								providerAccountId: account.providerAccountId,
								type: account.type,
								accessToken: account.access_token,
								expiresAt: Math.floor(Date.now() / 1000 + account.expires_in),
								refreshToken: account.refresh_token,
								tokenType: account.token_type,
								scope: account.scope,
								idToken: account.id_token,
								lastLogin: new Date()
							})
							.where(and(eq(accounts.provider, account.provider), eq(accounts.providerAccountId, account.providerAccountId)));
					}
				} else {
					// If there is no user logged in and we don't recognize the account, then we should
					// check if the account's email is already registered and prevent the sign in

					const email = user.email;
					const matchingUser = email ? await q.users.findFirst({ where: (users, { eq }) => eq(users.email, email) }) : undefined;
					const matchingProviders = matchingUser
						? await q.accounts
								.findMany({ where: (accounts, { eq }) => eq(accounts.userId, matchingUser.id) })
								.then((a) => a.map((a) => a.provider))
						: [];
					if (matchingProviders.length) {
						const names = matchingProviders.map((id) => PROVIDERS.find((p) => p.id === id)?.name).filter(isDefined);
						const joinedProviders = joinStringList(names);
						const message = `You already have an account with ${joinedProviders}. Sign in, then link additional providers in the settings menu.`;
						authErrRedirect("Existing Account", message, redirectUrl);
					}
				}

				if (user.id)
					await db
						.update(users)
						.set({ name: accountProfile.name, image: accountProfile.image })
						.where(eq(users.id, user.id as UserId));

				return true;
			},
			async session({ session, user }) {
				if (session.expires >= new Date())
					return {
						...session,
						user: { ...session.user, id: session.user.id as UserId }
					} satisfies LocalsSession;

				const account = await q.accounts.findFirst({
					where: (accounts, { and, eq, isNotNull }) => and(eq(accounts.userId, user.id as UserId), isNotNull(accounts.lastLogin)),
					orderBy: (account, { desc }) => desc(account.lastLogin)
				});

				if (account) {
					if (account.userId === user.id) {
						const [result] = await refreshToken(account);
						if (result instanceof Error) console.error(`RefreshAccessTokenError: ${result.message}`);
					}
				}

				return {
					...session,
					user: { ...session.user, id: session.user.id as UserId }
				} satisfies LocalsSession;
			}
		},
		secret: privateEnv.AUTH_SECRET,
		adapter: DrizzleAdapter(db),
		providers: providers.map((p) => p.oauth()),
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
		if (!account.refreshToken) throw new Error("No refresh token");

		if (!account.expiresAt || account.expiresAt * 1000 < Date.now()) {
			const response = await fetch(provider.tokenUrl, {
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					client_id: provider.clientId,
					client_secret: provider.clientSecret,
					grant_type: "refresh_token",
					refreshToken: account.refreshToken
				}),
				method: "POST"
			});

			const token = (await response.json()) as TokenSet;

			if (!response.ok) {
				console.error("Error refreshing access token:", token);
				throw new Error("See logs for details");
			}

			if (token) {
				if (!token.expires_in) throw new Error("No expires_in in token response");

				return await db
					.update(accounts)
					.set({
						accessToken: token.access_token,
						expiresAt: Math.floor(Date.now() / 1000 + token.expires_in),
						refreshToken: token.refresh_token ?? account.refreshToken,
						tokenType: token.token_type ?? account.tokenType,
						scope: token.scope ?? account.scope,
						idToken: token.id_token ?? account.idToken
					})
					.where(and(eq(accounts.provider, account.provider), eq(accounts.providerAccountId, account.providerAccountId)))
					.returning();
			}
		}

		return [];
	} catch (err) {
		if (err instanceof Error) return [err];
		else {
			console.error(err);
			return [new Error("Unknown error. See logs for details")];
		}
	}
}
