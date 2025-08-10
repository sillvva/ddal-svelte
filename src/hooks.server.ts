import { building } from "$app/environment";
import { appCookieSchema } from "$lib/schemas";
import { auth, getAuthSession } from "$lib/server/auth";
import { serverGetCookie } from "$lib/server/cookie";
import { DBService } from "$lib/server/db";
import { AdminService } from "$lib/server/effect/admin";
import { CharacterService } from "$lib/server/effect/characters";
import { DMService } from "$lib/server/effect/dms";
import { LogService } from "$lib/server/effect/logs";
import { UserService } from "$lib/server/effect/users";
import { type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { Layer, ManagedRuntime } from "effect";

const authHandler: Handle = async ({ event, resolve }) => {
	return svelteKitHandler({ event, resolve, auth, building });
};

const runtime: Handle = async ({ event, resolve }) => {
	const appLayer = Layer.mergeAll(
		CharacterService.DefaultWithoutDependencies(),
		LogService.DefaultWithoutDependencies(),
		DMService.DefaultWithoutDependencies(),
		UserService.DefaultWithoutDependencies(),
		AdminService.DefaultWithoutDependencies()
	).pipe(Layer.provide(DBService.Default()));
	event.locals.runtime = ManagedRuntime.make(appLayer);
	return await resolve(event);
};

const info: Handle = async ({ event, resolve }) => {
	event.locals.app = serverGetCookie("app", appCookieSchema);

	const userAgent = event.request.headers.get("user-agent");
	event.locals.isMac = /Macintosh|MacIntel|MacPPC|Mac68K|Mac OS/i.test(userAgent || "");
	event.locals.isMobile = !!userAgent?.match(
		/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/
	);

	return await resolve(event);
};

const session: Handle = async ({ event, resolve }) => {
	const isRemote = new URL(event.request.url).pathname.startsWith("/_app/remote");
	if (!event.route.id && !isRemote) return await resolve(event);

	const { session, user } = await getAuthSession(event);
	event.locals.session = session;
	event.locals.user = user;

	return await resolve(event);
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

export const handle = sequence(authHandler, runtime, info, session, preloadTheme);
