import Google from '@auth/core/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { SvelteKitAuth } from '@auth/sveltekit';
import { prisma } from './server/db';

import type { SvelteKitAuthConfig } from '@auth/sveltekit';
import type { Handle } from '@sveltejs/kit';
import type { Provider } from '@auth/core/providers';
import type { Profile } from '@auth/core/types';

export const authOptions = {
	// Include user.id on session
	callbacks: {
		session({ session, user }) {
			if (session.user) {
				session.user.id = user.id;
			}
			return session;
		}
	},
	secret: process.env.AUTH_SECRET,
	// Configure one or more authentication providers
	adapter: PrismaAdapter(prisma),
	providers: [
		Google({
			clientId: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET
		}) as Provider<Profile>
	]
} satisfies SvelteKitAuthConfig;

export const handle = SvelteKitAuth(authOptions) satisfies Handle;
