// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces

import type { AppCookie, LocalsSession, LocalsUser } from "$lib/schemas";
import type { AppRuntime } from "$lib/server/effect/runtime";
import type { FullCharacterData } from "$lib/server/effect/services/characters";
import "@auth/sveltekit";
import "@total-typescript/ts-reset/fetch";
import "@total-typescript/ts-reset/json-parse";

declare global {
	var initialized: boolean;

	namespace App {
		// interface Error {}
		interface Locals {
			session?: LocalsSession;
			user?: LocalsUser;
			isMobile: boolean;
			isMac: boolean;
			app: AppCookie;
			runtime: AppRuntime;
		}
		interface PageData {
			app: AppCookie;
			user: LocalsUser;
			session: LocalsSession;
			breadcrumbs: Array<{ name: string; href?: string }>;
			mobile: boolean;
			isMac: boolean;
			character?: FullCharacterData;
		}
		// interface Platform {}
		interface PageState {
			modal?:
				| {
						type: "text";
						name: string;
						description: string;
						goto?: string;
						date?: Date;
						width?: number | string;
						height?: number | string;
						maxWidth?: number | string;
						maxHeight?: number | string;
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

		interface ModuleData {
			getPageTitle?: (data: App.PageData) => string;
			pageTitle?: string;

			getHeadData?: (data: App.PageData) => {
				title: string;
				description?: string;
				image?: string;
			};
			headTitle?: string;
			headDescription?: string;
			headImage?: string;
		}
	}

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
