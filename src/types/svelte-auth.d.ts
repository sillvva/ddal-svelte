import type { DefaultSession } from '@auth/core/types';

declare module '@auth/core/types' {
	/**
	 * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
	 */
	interface Session {
		user?: {
			id: string;
		} & DefaultSession['user'];
	}
}
