import { appCookieSchema, type UserId } from "$lib/schemas";
import { auth } from "$server/auth";
import { serverGetCookie } from "$server/cookie";
import { db } from "$server/db";
import { type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { svelteKitHandler } from "better-auth/svelte-kit";

const authHandler: Handle = async ({ event, resolve }) => {
	return svelteKitHandler({ event, resolve, auth });
};

const session: Handle = async ({ event, resolve }) => {
	let localsSession: LocalsSession | null = null;
	try {
		const session = await auth.api.getSession({
			headers: event.request.headers
		});

		const accounts = await db.query.account.findMany({
			where: {
				userId: {
					eq: session?.user.id as UserId
				}
			}
		});

		const passkeys = await db.query.passkey.findMany({
			where: {
				userId: {
					eq: session?.user.id as UserId
				}
			}
		});

		localsSession = session && {
			...session.session,
			user: {
				...session.user,
				id: session.user.id as UserId,
				accounts,
				passkeys
			}
		};
	} catch (e) {}

	event.locals.session = localsSession;

	const response = await resolve(event);
	return response;
};

const preloadTheme: Handle = async ({ event, resolve }) => {
	const app = serverGetCookie("app", appCookieSchema);
	const mode = app.settings.mode;
	const theme = event.route.id?.startsWith("/(app)") ? app.settings.theme : app.settings.mode;

	return await resolve(event, {
		transformPageChunk: ({ html }) => {
			return html.replace(/%theme%/g, `class="${mode}" data-theme="${theme}"`);
		}
	});
};

export const handle = sequence(authHandler, session, preloadTheme);
