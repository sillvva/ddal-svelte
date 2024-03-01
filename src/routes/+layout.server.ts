import { building, dev } from "$app/environment";
import { env } from "$lib/env/check.js";
import { serverGetCookie } from "$src/server/cookie.js";
import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights/sveltekit";

let checked = false;
if (!checked && building && env) {
	console.log("✅ Environment variables are valid");
	checked = true;
}

inject({ mode: dev ? "development" : "production" });
injectSpeedInsights();

export const load = async (event) => {
	const session = event.locals.session;
	const mobile = !!event.request.headers
		.get("user-agent")
		?.match(
			/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/
		);

	const app = serverGetCookie<App.Cookie>(event.cookies, "app", {
		settings: {
			background: true,
			theme: "system",
			mode: "dark"
		},
		characters: {
			magicItems: false,
			display: "list"
		},
		log: {
			descriptions: false
		},
		dmLogs: {
			sort: "asc"
		}
	});

	if (mobile) app.settings.background = false;

	return {
		breadcrumbs: [] as Array<{ name: string; href?: string }>,
		session,
		mobile,
		app
	};
};
