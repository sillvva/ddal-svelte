import { building } from "$app/environment";
import { appCookieSchema } from "$lib/schemas";
import { serverGetCookie } from "$lib/server/cookie";
import { DBService } from "$lib/server/db";
import { AppLog } from "$lib/server/effect/logging";
import { run } from "$lib/server/effect/runtime";
import { AdminService } from "$lib/server/effect/services/admin";
import { AuthService } from "$lib/server/effect/services/auth";
import { CharacterService } from "$lib/server/effect/services/characters";
import { DMService } from "$lib/server/effect/services/dms";
import { LogService } from "$lib/server/effect/services/logs";
import { UserService } from "$lib/server/effect/services/users";
import { type Handle, type HandleServerError } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { svelteKitHandler } from "better-auth/svelte-kit";
import chalk from "chalk";
import { Effect, Layer, ManagedRuntime } from "effect";

const createAppRuntime = () => {
	const dbLayer = DBService.Default();

	const serviceLayer = Layer.mergeAll(
		AuthService.DefaultWithoutDependencies(),
		AdminService.DefaultWithoutDependencies(),
		CharacterService.DefaultWithoutDependencies(),
		DMService.DefaultWithoutDependencies(),
		LogService.DefaultWithoutDependencies(),
		UserService.DefaultWithoutDependencies()
	);

	const appLayer = serviceLayer.pipe(Layer.provide(dbLayer));

	return ManagedRuntime.make(appLayer);
};

const appRuntime = createAppRuntime();

const runtime: Handle = async ({ event, resolve }) => {
	event.locals.runtime = appRuntime;
	return await resolve(event);
};

const authHandler: Handle = async ({ event, resolve }) =>
	run(function* () {
		const Auth = yield* AuthService;
		const auth = yield* Auth.auth();
		return svelteKitHandler({ event, resolve, auth, building });
	});

const session: Handle = async ({ event, resolve }) =>
	run(function* () {
		const Auth = yield* AuthService;
		const { session, user } = yield* Auth.getAuthSession();
		event.locals.session = session;
		event.locals.user = user;

		if (user && event.cookies.get("banned")) event.cookies.delete("banned", { path: "/" });

		return resolve(event);
	});

const info: Handle = async ({ event, resolve }) => {
	event.locals.app = serverGetCookie("app", appCookieSchema);

	const userAgent = event.request.headers.get("user-agent");
	event.locals.isMac = /Macintosh|MacIntel|MacPPC|Mac68K|Mac OS/i.test(userAgent || "");
	event.locals.isMobile =
		/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/.test(
			userAgent || ""
		);

	return await resolve(event);
};

const preloadTheme: Handle = async ({ event, resolve }) => {
	const { settings } = event.locals.app;
	const mode = settings.mode;
	const theme = event.route.id === "/(home)" ? settings.mode : settings.theme;

	return await resolve(event, {
		transformPageChunk: ({ html }) => {
			return html.replace(/%mode%/g, `class="${mode}"`).replace(/%theme%/g, theme === "system" ? "" : `data-theme="${theme}"`);
		}
	});
};

export const handle = sequence(runtime, authHandler, session, info, preloadTheme);

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	if (status !== 404) Effect.runFork(AppLog.error(message, { error, url: event.url }));
	return { message };
};

if (typeof process !== "undefined") {
	process.on("sveltekit:shutdown", async (signal: string) => {
		console.log("\nShut down signal received:", chalk.bold(signal));

		try {
			console.log("Disposing app runtime...");
			await appRuntime.dispose();
			console.log("Ending DB connection...");
			await DBService.end();
			console.log("Exiting process...");
			process.exit(0);
		} catch (err) {
			console.error("Error during cleanup:", err);
			process.exit(1);
		}
	});
}
