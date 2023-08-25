import { AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "$env/static/private";
import Google from "@auth/core/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { SvelteKitAuth, type SvelteKitAuthConfig } from "@auth/sveltekit";
import { prisma } from "./server/db";

import type { Provider } from "@auth/core/providers";
import type { Profile, TokenSet } from "@auth/core/types";
import type { Handle } from "@sveltejs/kit";

export const auth = SvelteKitAuth({
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
			const account = await prisma.account.findFirst({
				where: { userId: user.id, provider: "google" }
			});
			if (account && (!account.expires_at || account.expires_at * 1000 < Date.now())) {
				try {
					if (!account.refresh_token) throw new Error("No refresh token");

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
								provider: "google",
								providerAccountId: account.providerAccountId
							}
						}
					});
				} catch (error) {
					console.error("Error refreshing access token:", error);
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
	adapter: PrismaAdapter(prisma),
	providers: [
		Google({
			clientId: GOOGLE_CLIENT_ID,
			clientSecret: GOOGLE_CLIENT_SECRET,
			authorization: { params: { access_type: "offline", prompt: "consent" } }
		}) as Provider<Profile>
	]
} satisfies SvelteKitAuthConfig) satisfies Handle;

export const handle = auth;
