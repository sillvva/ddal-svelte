import { building } from "$app/environment";
import { privateEnv } from "$lib/env/private.js";
import { appCookieSchema } from "$lib/schemas";
import { serverGetCookie } from "$lib/server/cookie";
import { DBService } from "$lib/server/db";
import { AppLog } from "$lib/server/effect/logging";
import { createAppRuntime, run } from "$lib/server/effect/runtime";
import { AuthService } from "$lib/server/effect/services/auth";
import { type Handle, type HandleServerError, type ServerInit } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { svelteKitHandler } from "better-auth/svelte-kit";
import chalk from "chalk";
import { Effect } from "effect";

let checked = false;
if (!checked && building && privateEnv) {
	console.log("\n✅ Environment variables are valid");
	console.table(privateEnv);
	console.log("\n");
	checked = true;
}

const appRuntime = createAppRuntime();

const runtime: Handle = async ({ event, resolve }) => {
	event.locals.runtime = appRuntime;
	return await resolve(event);
};

const authHandler: Handle = async ({ event, resolve }) =>
	run(function* () {
		const Auth = yield* AuthService;

		const { session, user, auth } = yield* Auth.getAuthSession();
		event.locals.session = session;
		event.locals.user = user;

		return svelteKitHandler({ event, resolve, auth, building });
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

export const handle = sequence(runtime, authHandler, info, preloadTheme);

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	if (status < 400 || (status === 500 && message === "Internal Error")) return { message };
	if (status !== 404) Effect.runFork(AppLog.error(message, { error, url: event.url, status }));
	return { message };
};

export const init: ServerInit = () => {
	if (globalThis.initialized) return;
	globalThis.initialized = true;

	console.log("Initializing server...");

	const gracefulShutdown = async (signal: string) => {
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
	};

	process.on("SIGINT", gracefulShutdown);
	process.on("SIGTERM", gracefulShutdown);
};
