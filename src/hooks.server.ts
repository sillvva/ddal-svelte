import {
	AUTH_SECRET,
	DISCORD_CLIENT_ID,
	DISCORD_CLIENT_SECRET,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET
} from "$env/static/private";
import Discord from "@auth/core/providers/discord";
import Google from "@auth/core/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { SvelteKitAuth, type SvelteKitAuthConfig } from "@auth/sveltekit";
import { handle as documentHandle } from "@sveltekit-addons/document/hooks";
import { prisma } from "./server/db";

import type { TokenSet } from "@auth/core/types";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";

export const auth = SvelteKitAuth(async (event) => {
	return {
		callbacks: {
			async signIn({ account }) {
				const currentSession = await event.locals.getSession();
				const currentUserId = currentSession?.user?.id;

				// If there is a user logged in already that we recognize,
				// and we have an account that is being signed in with
				if (account && currentUserId) {
					const currentAccounts = await prisma.account.findFirst({
						where: { userId: currentUserId, provider: account.provider }
					});

					if (currentAccounts) {
						throw new Error("You already have an account with this provider!");
					}

					// Do the account linking
					const existingAccount = await prisma.account.findFirst({
						where: { provider: account.provider, providerAccountId: account.providerAccountId }
					});

					if (existingAccount) {
						throw new Error("Account is already connected to another user!");
					}

					// Only link accounts that have not yet been linked
					// Link the new account
					await prisma.account.create({
						data: {
							provider: account.provider,
							providerAccountId: account.providerAccountId,
							userId: currentUserId,
							type: "oauth",
							access_token: account.access_token,
							expires_at: account.expires_in ? Math.floor(Date.now() / 1000 + account.expires_in) : undefined,
							refresh_token: account.refresh_token
						}
					});
				} else if (account?.refresh_token && account.expires_in) {
					await prisma.account.update({
						data: {
							access_token: account.access_token,
							expires_at: Math.floor(Date.now() / 1000 + account.expires_in),
							refresh_token: account.refresh_token
						},
						where: {
							provider_providerAccountId: {
								provider: account.provider,
								providerAccountId: account.providerAccountId
							}
						}
					});
				}

				return true;
			},
			async session({ session, ...params }) {
				let error = "";
				let userId = "";
				if ("user" in params) {
					const account = await prisma.account.findFirst({
						where: { userId: params.user.id }
					});
					if (account && (!account.expires_at || account.expires_at * 1000 < Date.now())) {
						try {
							if (!account.refresh_token) throw new Error("No refresh token");

							if (account.provider === "google") {
								// https://accounts.google.com/.well-known/openid-configuration
								// We need the `token_endpoint`.
								const response = await fetch("https://oauth2.googleapis.com/token", {
									headers: { "Content-Type": "application/x-www-form-urlencoded" },
									body: new URLSearchParams({
										client_id: GOOGLE_CLIENT_ID,
										client_secret: GOOGLE_CLIENT_SECRET,
										grant_type: "refresh_token",
										refresh_token: account.refresh_token
									}),
									method: "POST"
								});

								const tokens: TokenSet = await response.json();

								if (!response.ok) throw tokens;
								if (!tokens.expires_in) throw new Error("No expires_in in token response");

								await prisma.account.update({
									data: {
										access_token: tokens.access_token,
										expires_at: Math.floor(Date.now() / 1000 + tokens.expires_in),
										refresh_token: tokens.refresh_token ?? account.refresh_token
									},
									where: {
										provider_providerAccountId: {
											provider: account.provider,
											providerAccountId: account.providerAccountId
										}
									}
								});
							}

							if (account.provider === "discord") {
								const response = await fetch("https://discord.com/api/v10/oauth2/token", {
									headers: { "Content-Type": "application/x-www-form-urlencoded" },
									body: new URLSearchParams({
										client_id: DISCORD_CLIENT_ID,
										client_secret: DISCORD_CLIENT_SECRET,
										grant_type: "refresh_token",
										refresh_token: account.refresh_token
									}),
									method: "POST"
								});

								const tokens: TokenSet = await response.json();

								if (!response.ok) throw tokens;
								if (!tokens.expires_in) throw new Error("No expires_in in token response");

								await prisma.account.update({
									data: {
										access_token: tokens.access_token,
										expires_at: Math.floor(Date.now() / 1000 + tokens.expires_in),
										refresh_token: tokens.refresh_token ?? account.refresh_token
									},
									where: {
										provider_providerAccountId: {
											provider: account.provider,
											providerAccountId: account.providerAccountId
										}
									}
								});
							}
						} catch (err) {
							console.error("Error refreshing access token:", err);
							error = "RefreshAccessTokenError";
						}
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
		providers: [
			Google({
				clientId: GOOGLE_CLIENT_ID,
				clientSecret: GOOGLE_CLIENT_SECRET,
				authorization: { params: { access_type: "offline", prompt: "consent" } }
			}),
			Discord({ clientId: DISCORD_CLIENT_ID, clientSecret: DISCORD_CLIENT_SECRET })
		],
		trustHost: true
	} satisfies SvelteKitAuthConfig;
}) satisfies Handle;

export const session: Handle = async ({ event, resolve }) => {
	const session: CustomSession | null = await event.locals.getSession();

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
