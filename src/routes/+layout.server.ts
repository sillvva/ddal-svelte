import { building } from "$app/environment";
import { serverGetCookie } from "$src/server/cookie.js";
import { checkEnv } from "$src/server/env.js";

if (building) {
	checkEnv().then((env) => {
		if (env) console.log("✅ Environment variables are valid");
	});
}

export const load = async (event) => {
	const mobile = !!event.request.headers
		.get("user-agent")
		?.match(
			/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/
		);

	const appCookie = serverGetCookie<App.Cookie>(event.cookies, "app", {
		settings: {
			background: !mobile,
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

	return {
		session: event.locals.session,
		breadcrumbs: [] as Array<{ name: string; href?: string }>,
		app: appCookie,
		mobile
	};
};
