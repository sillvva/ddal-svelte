import { building } from "$app/environment";
import { checkEnv } from "$src/lib/types/env";
import type { App } from "$src/lib/types/schemas";
import { serverGetCookie } from "$src/server/cookie.js";

if (building) {
	checkEnv().then((env) => {
		if (env) console.log("✅ Environment variables are valid");
	});
}

export const load = async (event) => {
	const appCookie = serverGetCookie<App>(event.cookies, "app", {
		settings: {
			background: true,
			theme: "system",
			mode: "dark"
		},
		character: {
			descriptions: false
		},
		characters: {
			magicItems: false,
			display: "list"
		},
		dmLogs: {
			sort: "asc"
		}
	});

	return {
		session: event.locals.session,
		breadcrumbs: [] as Array<{ name: string; href?: string }>,
		app: appCookie,
		mobile: !!event.request.headers
			.get("user-agent")
			?.match(
				/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/
			)
	};
};
