import { AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "$env/static/private";
import Google from "@auth/core/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { SvelteKitAuth } from "@auth/sveltekit";
import { prisma } from "./server/db";

import type { SvelteKitAuthConfig } from "@auth/sveltekit";
import type { Handle } from "@sveltejs/kit";
import type { Provider } from "@auth/core/providers";
import type { Profile, TokenSet } from "@auth/core/types";

export const authOptions = {
	callbacks: {
		async signIn({ account }) {
			if (account?.refresh_token && account.expires_in) {
				await prisma.account.update({
					data: {
						access_token: account.access_token,
						expires_at: Math.floor(Date.now() / 1000 + account.expires_in),
						refresh_token: account.refresh_token
					},
					where: {
						provider_providerAccountId: {
							provider: "google",
							providerAccountId: account.providerAccountId
						}
					}
				});
			}
			return true;
		},
		async session({ session, user }) {
			const [google] = await prisma.account.findMany({
				where: { userId: user.id, provider: "google" }
			});
			if (!google.expires_at || google.expires_at * 1000 < Date.now()) {
				// If the access token has expired, try to refresh it
				try {
					// https://accounts.google.com/.well-known/openid-configuration
					// We need the `token_endpoint`.
					const response = await fetch("https://oauth2.googleapis.com/token", {
						headers: { "Content-Type": "application/x-www-form-urlencoded" },
						body: new URLSearchParams({
							client_id: GOOGLE_CLIENT_ID,
							client_secret: GOOGLE_CLIENT_SECRET,
							grant_type: "refresh_token",
							refresh_token: google.refresh_token || ""
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
							refresh_token: tokens.refresh_token ?? google.refresh_token
						},
						where: {
							provider_providerAccountId: {
								provider: "google",
								providerAccountId: google.providerAccountId
							}
						}
					});
				} catch (error) {
					console.error("Error refreshing access token", error);
					// The error property will be used client-side to handle the refresh token error
					session.error = "RefreshAccessTokenError";
				}
			}
			if (session.user) {
				session.user.id = user.id;
			}
			return session;
		}
	},
	secret: AUTH_SECRET,
	// Configure one or more authentication providers
	adapter: PrismaAdapter(prisma),
	trustHost: true,
	cookies: {
		sessionToken: {
			name: "next-auth.session-token",
			options: {
				expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
			}
		}
	},
	providers: [
		Google({
			clientId: GOOGLE_CLIENT_ID,
			clientSecret: GOOGLE_CLIENT_SECRET,
			authorization: { params: { access_type: "offline", prompt: "consent" } }
		}) as Provider<Profile>
	]
} satisfies SvelteKitAuthConfig;

export const handle = SvelteKitAuth(authOptions) satisfies Handle;
