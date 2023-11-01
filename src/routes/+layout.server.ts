import { building } from "$app/environment";
import { checkEnv } from "$src/lib/types/env";
import { serverGetCookie } from "$src/server/cookie.js";
import { defaultUserCookie } from "$src/server/data/cookies.js";

if (building) {
	checkEnv().then((env) => {
		if (env) console.log("✅ Environment variables are valid");
	});
}

export const load = async (event) => {
	const userCookie = serverGetCookie(event.cookies, "user", defaultUserCookie);

	return {
		session: event.locals.session,
		breadcrumbs: [] as Array<{ name: string; href?: string }>,
		mobile:
			userCookie.hideBackground ||
			!!event.request.headers
				.get("user-agent")
				?.match(
					/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/
				)
	};
};
