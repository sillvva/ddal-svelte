import type { DefaultSession } from "@auth/core/types";

declare global {
	interface CustomSession {
		user?: {
			id?: string;
		} & DefaultSession["user"];
		error?: string;
	}

	interface LocalsSession {
		user?: {
			id: string;
		} & DefaultSession["user"];
		error?: string;
	}
}
