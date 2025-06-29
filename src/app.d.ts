// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces

import type { UserId } from "$lib/schemas";
import type { Account, AuthClient, User } from "$server/db/schema";
import "@auth/sveltekit";
import type { Session } from "@auth/sveltekit";
import type { Prettify } from "@sillvva/utils";
import "@total-typescript/ts-reset/fetch";
import "@total-typescript/ts-reset/json-parse";

declare module "@auth/sveltekit" {
	interface User {
		id: UserId;
		name: string;
		email: string;
	}

	interface AdapterUser {
		id: UserId;
		name: string;
		email: string;
	}

	interface Session {
		user: Prettify<AdapterUser & User>;
	}
}

interface PageDataUser extends User {
	accounts: Account[];
	authenticators: AuthClient[];
}

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: Session | null;
		}
		interface PageData {
			user: PageDataUser | undefined;
			breadcrumbs: Array<{ name: string; href?: string }>;
			mobile: boolean;
			isMac: boolean;
			title?: string;
			description?: string;
			image?: string;
		}
		// interface Platform {}
		interface PageState {
			modal?:
				| {
						type: "text";
						name: string;
						description: string;
						date?: Date;
				  }
				| {
						type: "image";
						name: string;
						imageUrl: string;
				  };
		}
		namespace Superforms {
			type Message = {
				type: "error" | "success";
				text: string;
			};
		}
	}

	type LocalsSession = Session;

	interface ViewTransition {
		/**
		 * A Promise that fulfills once the transition animation is finished,
		 * and the new page view is visible and interactive to the user.
		 */
		finished: Promise<void>;
		/**
		 * A Promise that fulfills once the pseudo-element tree is created
		 * and the transition animation is about to start.
		 */
		ready: Promise<void>;
		/**
		 * A Promise that fulfills when the promise returned by the
		 * document.startViewTransition()'s callback fulfills.
		 */
		updateCallbackDone: Promise<void>;
		/**
		 * Skips the animation part of the view transition, but doesn't skip
		 * running the document.startViewTransition() callback that updates the DOM.
		 */
		skipTransition: () => void;
	}

	type ViewTransitionCallback = (() => Promise<void>) | (() => void);

	interface Document {
		startViewTransition: (callback: ViewTransitionCallback) => ViewTransition;
	}
}
