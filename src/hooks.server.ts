import { appCookieSchema } from "#lib/schemas.js";
import { serverGetCookie } from "#lib/server/cookie.js";
import { DBService } from "#lib/server/db/index.js";
import { AppLog } from "#lib/server/effect/logging.js";
import { createAppRuntime, run } from "#lib/server/effect/runtime.js";
import { AuthService } from "#lib/server/effect/services/auth.js";
import { building } from "$app/env";
import { sequence, type Handle, type HandleServerError, type ServerInit } from "@sveltejs/kit/hooks";
import { svelteKitHandler } from "better-auth/svelte-kit";
import chalk from "chalk";
import { Effect } from "effect";

const appRuntime = createAppRuntime();

const runtime: Handle = async ({ event, resolve }) => {
	const headerPath = event.request.headers.get("x-sveltekit-pathname");
	const headerSearch = event.request.headers.get("x-sveltekit-search") ?? "";
	event.locals.requestPath =
		event.isRemoteRequest && headerPath?.startsWith("/") && !headerPath.startsWith("//")
			? `${headerPath}${headerSearch}`
			: event.isRemoteRequest
				? "/characters"
				: `${event.url.pathname}${event.url.search}`;
	event.locals.routeId = event.route.id;
	event.locals.params = event.params;
	event.locals.runtime = appRuntime;
	return await resolve(event);
};

const authHandler: Handle = async ({ event, resolve }) =>
	run(function* () {
		const Auth = yield* AuthService;

		const { session, user, auth } = yield* Auth.get.session();
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

function report(message: string, extra: Record<string, unknown>) {
	try {
		Effect.runFork(AppLog.error(message, extra));
	} catch {
		// handleError must not throw. A logging failure would replace the real response with a generic 500.
	}
}

export const handleError: HandleServerError = (input) => {
	const { kind, error, event } = input;

	// Expected app and framework responses. 404s and client errors are not defects.
	if (kind === "app" || kind === "framework") {
		if (error.status === 404 || (kind === "app" && error.status < 500)) return error;

		report(error.message, { error, url: event.url.href, status: error.status, kind });
		return error;
	}

	// Validation failures stay a generic 400. Issues are logged and not returned to the client.
	if (kind === "validation") {
		report(error.message, {
			error,
			url: event.url.href,
			status: error.status,
			kind,
			issues: input.issues
		});
		return;
	}

	report("Internal Error", { error, url: event.url.href, status: 500, kind });
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
