import {
	AUTH_SECRET,
	DISCORD_CLIENT_ID,
	DISCORD_CLIENT_SECRET,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET
} from "$env/static/private";
import { prisma } from "$src/server/db";
import type { Provider } from "@auth/core/providers";
import Discord from "@auth/core/providers/discord";
import Google from "@auth/core/providers/google";
import type { Profile, TokenSet } from "@auth/core/types";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { SvelteKitAuth, type SvelteKitAuthConfig } from "@auth/sveltekit";
import type { Account } from "@prisma/client";
import { redirect, type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { handle as documentHandle } from "@sveltekit-addons/document/hooks";
import { createHash } from "crypto";
import { authErrRedirect } from "./server/auth";

interface OAuthProvider {
	id: string;
	tokenUrl: string;
	clientId: string;
	clientSecret: string;
	accountId: (profile: Profile) => string;
	oauth: () => Provider;
}
const providers: OAuthProvider[] = [
	{
		id: "google",
		tokenUrl: "https://oauth2.googleapis.com/token",
		clientId: GOOGLE_CLIENT_ID,
		clientSecret: GOOGLE_CLIENT_SECRET,
		accountId: function (profile: Profile) {
			return profile.sub as string;
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
		clientId: DISCORD_CLIENT_ID,
		clientSecret: DISCORD_CLIENT_SECRET,
		accountId: function (profile: Profile) {
			return profile.id as string;
		},
		oauth: function () {
			return Discord({
				clientId: this.clientId,
				clientSecret: this.clientSecret
			});
		}
	}
];

export const auth = SvelteKitAuth(async (event) => {
	return {
		callbacks: {
			async signIn({ account, profile, user }) {
				if (!account) authErrRedirect(401, "Account not found");
				if (!profile) authErrRedirect(401, "Profile not found");

				const provider = providers.find((p) => p.id === account.provider);
				if (!provider) authErrRedirect(401, `Provider '${account.provider}' not found`);

				if (!user.email) authErrRedirect(401, "Email not found");

				const providerAccountId = createHash("sha1").update(`${account.provider} ${user.email}`).digest("hex");
				const currentSession = await event.locals.auth();
				const currentUserId = currentSession?.user?.id;

				const existingAccount = await prisma.account.findFirst({
					where: {
						provider: account.provider,
						OR: [
							{ providerAccountId: providerAccountId },
							{ providerAccountId: account.providerAccountId },
							{ providerAccountId: provider.accountId(profile) }
						]
					}
				});

				account.providerAccountId = providerAccountId;

				// If there is a user logged in already that we recognize,
				// and we have an account that is being signed in with
				if (currentUserId) {
					// Only link accounts that have not yet been linked
					if (existingAccount) authErrRedirect(401, "Account already linked to a user");

					// Do the account linking
					await prisma.account.create({
						data: {
							provider: account.provider,
							providerAccountId: account.providerAccountId,
							userId: currentUserId,
							type: account.type,
							access_token: account.access_token,
							expires_at: account.expires_in ? Math.floor(Date.now() / 1000 + account.expires_in) : undefined,
							refresh_token: account.refresh_token,
							token_type: account.token_type,
							scope: account.scope,
							id_token: account.id_token
						}
					});

					redirect(302, "/characters");
				} else if (existingAccount) {
					event.cookies.set("authjs.provider", account.provider, {
						path: "/",
						expires: new Date(new Date().getTime() + 30 * 86400 * 1000)
					});

					if (account.refresh_token && account.expires_in) {
						await prisma.account.update({
							data: {
								providerAccountId: account.providerAccountId,
								type: account.type,
								access_token: account.access_token,
								expires_at: Math.floor(Date.now() / 1000 + account.expires_in),
								refresh_token: account.refresh_token,
								token_type: account.token_type,
								scope: account.scope,
								id_token: account.id_token
							},
							where: {
								provider_providerAccountId: {
									provider: existingAccount.provider,
									providerAccountId: existingAccount.providerAccountId
								}
							}
						});
					}
				}

				return true;
			},
			async session({ session, ...params }) {
				let error = "";
				let userId = "";

				if ("user" in params) {
					const currentProvider = event.cookies.get("authjs.provider");
					const account = await prisma.account.findFirst({
						where: { userId: params.user.id, provider: currentProvider }
					});

					if (account) {
						event.cookies.set("authjs.provider", account.provider, { path: "/", expires: new Date(session.expires) });

						const result = await refreshToken(account);
						if (result instanceof Error) error = `RefreshAccessTokenError: ${result.message}`;
					} else {
						event.cookies.delete("authjs.provider", { path: "/" });
						error = "NoAccountError: No account found";
					}

					if (session.user) {
						userId = params.user.id;
					}
				}

				return {
					...session,
					error,
					user: session.user && {
						...session.user,
						id: userId
					}
				} satisfies LocalsSession;
			}
		},
		secret: AUTH_SECRET,
		adapter: PrismaAdapter(prisma),
		providers: providers.map((p) => p.oauth()),
		trustHost: true,
		pages: {
			signIn: "/",
			error: "/auth/err"
		}
	} satisfies SvelteKitAuthConfig;
}) satisfies Handle;

export const session: Handle = async ({ event, resolve }) => {
	const session = await event.locals.auth();

	event.locals.session = session && {
		...session,
		user: session.user && {
			...session.user,
			id: session.user?.id ?? ""
		}
	};

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

export const handle = sequence(auth, session, documentHandle);

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

			const tokens: TokenSet = await response.json();

			if (!response.ok) {
				console.error("Error refreshing access token:", tokens);
				throw new Error("See logs for details");
			}

			if (tokens) {
				if (!tokens.expires_in) throw new Error("No expires_in in token response");

				return await prisma.account.update({
					data: {
						access_token: tokens.access_token,
						expires_at: Math.floor(Date.now() / 1000 + tokens.expires_in),
						refresh_token: tokens.refresh_token ?? account.refresh_token,
						token_type: account.token_type,
						scope: account.scope,
						id_token: account.id_token
					},
					where: {
						provider_providerAccountId: {
							provider: account.provider,
							providerAccountId: account.providerAccountId
						}
					}
				});
			}
		}

		return null;
	} catch (err) {
		if (err instanceof Error) return err;
		else {
			console.error(err);
			return new Error("Unknown error. See logs for details");
		}
	}
}
